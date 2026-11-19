"""
Évolution génétique à grande échelle (version 2) : modèle d'îles + NSGA-II.

- I populations (« îles ») de N stratégies évoluent en parallèle ; toutes les K générations, chaque île envoie
  ses meilleures stratégies à sa voisine (migration en anneau).
- À chaque génération : nouveaux destins aléatoires, enfants par tournoi + croisement + mutation, évaluation
  sur M vies (mêmes destins pour toutes les stratégies), puis sélection non dominée sur 3 objectifs.
- Les survivantes accumulent des vies simulées (jusqu'à NMAX) : plus une stratégie survit, plus son score est précis.
- Un panthéon garde les meilleures stratégies jamais vues (pour l'évaluation finale à très grand nombre de vies).

Objectifs (maximisés) : S vitesse vers 10 k€/mois, U potentiel licorne (échelle log), D part du temps passé à
≥ 10 k€/mois entre la 3e et la 10e année. Contrainte : risque judiciaire ≤ 2 %.
"""
import argparse
import json
import os
import time
import numpy as np

from model import (evaluate, evaluate_sums, draw_randoms, canonicalize_nb, NG, NM, GENE_CARD, METRIC_NAMES,
                   G_E1, G_E2, G_E3, G_THR12, G_DL12, G_THR23, G_DL23, G_SECTOR, G_CHANNEL, G_CONTENT,
                   G_PRICE, G_HOURS, G_LEARN, G_REINV, G_FUND, G_RAISE, G_GEO, G_COF, G_NICHE, G_KEEP,
                   G_BASE, G_HSTART, G_RAMP, M_S, M_PUNI, M_DUR, M_DUR2, M_CAT, M_I12, M_I24, M_I60,
                   M_LOGW, M_T10K, T_MONTHS, NE)
from params import ENG, SEC, WORLD_NOMINAL, ENGINES_SHORT, SECTORS, CHANNELS, GENE_LABELS

RES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
ORDINAL = np.zeros(NG, dtype=bool)
ORDINAL[[G_THR12, G_DL12, G_THR23, G_DL23, G_CONTENT, G_PRICE, G_HOURS, G_LEARN, G_REINV, G_RAISE, G_FUND,
         G_GEO, G_HSTART, G_RAMP]] = True
WORLD_SIGMA = np.array([0.3, 0.5, 0.3, 0.5, 0.4, 0.3, 0.5, 0.4, 0.5, 0.4, 0.5, 0.3, 0.004, 0.5, 0.35, 0.4, 0.01])
ADDITIVE = {12, 16}
_POW = (np.uint64(1000003) ** np.arange(NG, dtype=np.uint64)).astype(np.uint64)


def canon(G):
    return canonicalize_nb(np.ascontiguousarray(G, dtype=np.int64), ENG)


def hashes(G):
    return (G.astype(np.uint64) * _POW[None, :]).sum(1)


def objectives(st):
    F = np.stack([st[:, M_S], np.log10(st[:, M_PUNI] + 1e-7), st[:, M_DUR2]], 1)
    viol = np.maximum(0.0, st[:, M_CAT] - 0.02)
    return F, viol


def utility(st, w=(0.45, 0.30, 0.25)):
    us = np.clip((np.log10(st[:, M_PUNI] + 1e-7) + 5.0) / 3.0, 0.0, 1.0)
    return w[0] * st[:, M_S] + w[1] * us + w[2] * st[:, M_DUR2] - 3.0 * np.maximum(0.0, st[:, M_CAT] - 0.01)


def nd_sort(F, viol):
    feas = viol <= 0
    ge = (F[:, None, :] >= F[None, :, :]).all(-1)
    gt = (F[:, None, :] > F[None, :, :]).any(-1)
    dom = ge & gt & feas[:, None] & feas[None, :]
    dom |= feas[:, None] & ~feas[None, :]
    dom |= (~feas[:, None]) & (~feas[None, :]) & (viol[:, None] < viol[None, :])
    n_dom = dom.sum(0).astype(np.int64)
    rank = np.full(len(F), -1)
    r = 0
    cur = np.where(n_dom == 0)[0]
    while cur.size:
        rank[cur] = r
        n_dom = n_dom - dom[cur].sum(0)
        n_dom[rank >= 0] = -1
        cur = np.where(n_dom == 0)[0]
        r += 1
    return rank


def crowding(F, rank):
    cd = np.zeros(len(F))
    span = F.max(0) - F.min(0) + 1e-12
    for r in np.unique(rank):
        idx = np.where(rank == r)[0]
        if idx.size <= 2:
            cd[idx] = np.inf
            continue
        for k in range(F.shape[1]):
            o = idx[np.argsort(F[idx, k])]
            cd[o[0]] = cd[o[-1]] = np.inf
            cd[o[1:-1]] += (F[o[2:], k] - F[o[:-2], k]) / span[k]
    return cd


def path_of(g):
    p = [int(g[G_E1])]
    for e in (int(g[G_E2]), int(g[G_E3])):
        if e != p[-1]:
            p.append(e)
    return p


def path_name(g):
    return " → ".join(ENGINES_SHORT[e] for e in path_of(g))


def describe(g):
    p = path_of(g)
    d = {"parcours": path_name(g), "genome": [int(x) for x in g]}
    if len(p) >= 2:
        d["passage 1→2"] = (f"dès {GENE_LABELS['thr'][g[G_THR12]]} pendant 3 mois" if g[G_THR12] else "") + \
            (f" ou au plus tard après {GENE_LABELS['dl'][g[G_DL12]]}" if g[G_DL12] != 8 else "")
    if len(p) >= 3:
        d["passage 2→3"] = (f"dès {GENE_LABELS['thr'][g[G_THR23]]} pendant 3 mois" if g[G_THR23] else "") + \
            (f" ou au plus tard après {GENE_LABELS['dl'][g[G_DL23]]}" if g[G_DL23] != 8 else "")
    d.update({
        "activité de base": GENE_LABELS["base"][g[G_BASE]], "heures au début": GENE_LABELS["hstart"][g[G_HSTART]],
        "passage à temps plein": GENE_LABELS["ramp"][g[G_RAMP]], "heures à temps plein": GENE_LABELS["hours"][g[G_HOURS]],
        "secteur": SECTORS[g[G_SECTOR]], "canal": CHANNELS[g[G_CHANNEL]],
        "part de temps en contenu": GENE_LABELS["content"][g[G_CONTENT]],
        "niveau de prix": GENE_LABELS["price"][g[G_PRICE]],
        "temps d'apprentissage": GENE_LABELS["learn"][g[G_LEARN]],
        "réinvestissement des bénéfices": GENE_LABELS["reinv"][g[G_REINV]],
        "financement": GENE_LABELS["fund"][g[G_FUND]], "déclencheur de levée": GENE_LABELS["raise"][g[G_RAISE]],
        "géographie": GENE_LABELS["geo"][g[G_GEO]], "associé": GENE_LABELS["cof"][g[G_COF]],
        "positionnement": GENE_LABELS["niche"][g[G_NICHE]], "garder les services": GENE_LABELS["keep"][g[G_KEEP]],
    })
    return d


class Islands:
    def __init__(self, n_islands, pop, M, nmax, seed, world, lock=None, mig_every=50, mig_k=3, hof_size=4000,
                 hof_min=128):
        self.I, self.N, self.M, self.nmax = n_islands, pop, M, nmax
        self.rng = np.random.default_rng(seed)
        self.world = np.asarray(world, dtype=np.float64)
        self.lock = lock
        self.mig_every, self.mig_k = mig_every, mig_k
        self.hof = {}
        self.hof_size, self.hof_min = hof_size, hof_min
        self.lives = 0
        self.gens = 0
        self.hash_chunks = []
        self.stats = {}   # clé -> [sommes (NM), n] pour les stratégies vivantes
        P = self.random(n_islands * pop)
        self.P = P
        self._evaluate(P)

    def random(self, n):
        G = self.rng.integers(0, GENE_CARD, size=(n, NG))
        if self.lock is not None:
            G[:, :3] = self.lock
        return canon(G)

    @staticmethod
    def key(g):
        return g.astype(np.int8).tobytes()

    def _evaluate(self, G):
        keys = [self.key(g) for g in G]
        need_idx, seen = [], set()
        for i, k in enumerate(keys):
            if k in seen:
                continue
            seen.add(k)
            v = self.stats.get(k)
            if v is None or v[1] < self.nmax:
                need_idx.append(i)
        if need_idx:
            E = G[need_idx]
            U, Z, UI, ZI = draw_randoms(self.rng, self.M)
            sums = evaluate_sums(E, U, Z, UI, ZI, ENG, SEC, self.world)
            self.lives += len(E) * self.M
            new = []
            for j, i in enumerate(need_idx):
                k = keys[i]
                v = self.stats.get(k)
                if v is None:
                    self.stats[k] = [sums[j].copy(), self.M]
                    new.append(i)
                else:
                    v[0] += sums[j]
                    v[1] += self.M
            if new:
                self.hash_chunks.append(hashes(G[new]))
        return keys

    def means(self, keys):
        return np.array([self.stats[k][0] / self.stats[k][1] for k in keys])

    def counts(self, keys):
        return np.array([self.stats[k][1] for k in keys])

    def vary(self, P, rank, cd):
        I, N = self.I, self.N
        base = np.repeat(np.arange(I) * N, N)
        a = base + self.rng.integers(0, N, I * N)
        b = base + self.rng.integers(0, N, I * N)
        better = (rank[a] < rank[b]) | ((rank[a] == rank[b]) & (cd[a] > cd[b]))
        pa = P[np.where(better, a, b)]
        a = base + self.rng.integers(0, N, I * N)
        b = base + self.rng.integers(0, N, I * N)
        better = (rank[a] < rank[b]) | ((rank[a] == rank[b]) & (cd[a] > cd[b]))
        pb = P[np.where(better, a, b)]
        n = I * N
        C = pa.copy()
        cx = self.rng.random(n) < 0.9
        mask = (self.rng.random((n, NG)) < 0.5) & cx[:, None]
        C[mask] = pb[mask]
        block = self.rng.random(n) < 0.3
        C[block, :7] = pb[block, :7]
        pm = 1.5 / NG
        mut = self.rng.random((n, NG)) < pm
        step = self.rng.random((n, NG)) < 0.7
        rnd = self.rng.integers(0, GENE_CARD, size=(n, NG))
        delta = np.where(self.rng.random((n, NG)) < 0.5, -1, 1)
        stepped = np.clip(C + delta, 0, GENE_CARD - 1)
        C = np.where(mut & step & ORDINAL[None, :], stepped, np.where(mut, rnd, C))
        imm = self.rng.random(n) < 0.03
        C[imm] = self.rng.integers(0, GENE_CARD, size=(int(imm.sum()), NG))
        if self.lock is not None:
            C[:, :3] = self.lock
        return canon(C)

    def step(self, rank, cd):
        I, N = self.I, self.N
        C = self.vary(self.P, rank, cd)
        allG = np.vstack([self.P, C])
        keys = self._evaluate(allG)
        newP = np.empty_like(self.P)
        new_rank = np.empty(I * N, dtype=np.int64)
        new_cd = np.empty(I * N)
        keep_keys = set()
        for i in range(I):
            idx = np.concatenate([np.arange(i * N, (i + 1) * N), I * N + np.arange(i * N, (i + 1) * N)])
            sub_keys = [keys[j] for j in idx]
            # dédoublonnage dans l'île
            uniq, first = {}, []
            for j, k in zip(idx, sub_keys):
                if k not in uniq:
                    uniq[k] = j
                    first.append(j)
            first = np.array(first)
            fk = [keys[j] for j in first]
            st = self.means(fk)
            F, viol = objectives(st)
            r = nd_sort(F, viol)
            c = crowding(F, r)
            order = np.lexsort((-c, r))
            take = first[order[:N]]
            if len(take) < N:  # pas assez de stratégies distinctes : on complète au hasard
                extra = self.random(N - len(take))
                self._evaluate(extra)
                sel = np.vstack([allG[take], extra])
                rr = np.concatenate([r[order[:len(take)]], np.full(N - len(take), r.max() + 1)])
                cc = np.concatenate([c[order[:len(take)]], np.zeros(N - len(take))])
            else:
                sel = allG[take]
                rr = r[order[:N]]
                cc = c[order[:N]]
            newP[i * N:(i + 1) * N] = sel
            new_rank[i * N:(i + 1) * N] = rr
            new_cd[i * N:(i + 1) * N] = cc
            for g in sel:
                keep_keys.add(self.key(g))
        self.P = newP
        # on oublie les mortes (le panthéon garde les meilleures)
        self.stats = {k: v for k, v in self.stats.items() if k in keep_keys}
        self.gens += 1
        if self.gens % self.mig_every == 0 and I > 1:
            self.migrate(new_rank, new_cd)
        return new_rank, new_cd

    def migrate(self, rank, cd):
        I, N, k = self.I, self.N, self.mig_k
        keys = [self.key(g) for g in self.P]
        ut = utility(self.means(keys))
        best = [i * N + np.argsort(-ut[i * N:(i + 1) * N])[:k] for i in range(I)]
        P2 = self.P.copy()
        for i in range(I):
            dst = (i + 1) % I
            worst = dst * N + np.argsort(ut[dst * N:(dst + 1) * N])[:k]
            P2[worst] = self.P[best[i]]
        self.P = P2
        self._evaluate(self.P)

    def update_hof(self):
        keys = [self.key(g) for g in self.P]
        for k, g in zip(keys, self.P):
            v = self.stats[k]
            if v[1] >= self.hof_min:
                h = self.hof.get(k)
                if h is None or h[1] < v[1]:
                    self.hof[k] = [v[0].copy(), v[1], g.copy()]
        if len(self.hof) > self.hof_size:
            ks = list(self.hof.keys())
            st = np.array([self.hof[k][0] / self.hof[k][1] for k in ks])
            ut = utility(st)
            keep = set(np.argsort(-ut)[: self.hof_size // 2].tolist())
            for j in range(3):
                col = [M_S, M_PUNI, M_DUR2][j]
                keep |= set(np.argsort(-st[:, col])[: self.hof_size // 6].tolist())
            self.hof = {ks[i]: self.hof[ks[i]] for i in keep}

    def unique_count(self):
        if not self.hash_chunks:
            return 0
        allh = np.concatenate(self.hash_chunks)
        u = np.unique(allh)
        self.hash_chunks = [u]
        return int(len(u))

    def snapshot(self, top_paths=12):
        keys = [self.key(g) for g in self.P]
        st = self.means(keys)
        n = self.counts(keys)
        ok = n >= min(self.hof_min, self.nmax)
        ut = utility(st)
        ut_ok = np.where(ok, ut, -9)
        b = int(np.argmax(ut_ok))
        paths = {}
        for g in self.P:
            pn = path_name(g)
            paths[pn] = paths.get(pn, 0) + 1
        top = sorted(paths.items(), key=lambda x: -x[1])[:top_paths]
        return {"gen": self.gens, "vies": int(self.lives), "best_util": float(ut_ok[b]),
                "best": path_name(self.P[b]), "best_genome": [int(x) for x in self.P[b]],
                "best_S": float(st[ok, M_S].max()) if ok.any() else 0.0,
                "best_U": float(st[ok, M_PUNI].max()) if ok.any() else 0.0,
                "best_D": float(st[ok, M_DUR2].max()) if ok.any() else 0.0,
                "mean_util": float(ut.mean()), "paths": top,
                "e1_share": (np.bincount(self.P[:, G_E1], minlength=NE) / len(self.P)).round(4).tolist()}


def run_islands(I, N, M, nmax, seed, world=WORLD_NOMINAL, lock=None, seconds=None, gens=None, label="",
                log_every=10, verbose=True, hof_every=20, checkpoint=None):
    isl = Islands(I, N, M, nmax, seed, world, lock=lock)
    keys = [isl.key(g) for g in isl.P]
    st = isl.means(keys)
    rank = np.zeros(I * N, dtype=np.int64)
    cd = np.zeros(I * N)
    for i in range(I):
        sl = slice(i * N, (i + 1) * N)
        F, viol = objectives(st[sl])
        rank[sl] = nd_sort(F, viol)
        cd[sl] = crowding(F, rank[sl])
    log = []
    t0 = time.time()
    last_print = 0.0
    while True:
        rank, cd = isl.step(rank, cd)
        if isl.gens % hof_every == 0:
            isl.update_hof()
        if isl.gens % log_every == 0:
            snap = isl.snapshot()
            snap["t"] = round(time.time() - t0, 1)
            log.append(snap)
            if verbose and (time.time() - last_print > 60 or isl.gens <= log_every):
                last_print = time.time()
                print(f"[{label}] gén {isl.gens:6d} ×{I} îles | {snap['t']:7.0f}s | {isl.lives / 1e9:6.3f} Md vies | "
                      f"util {snap['best_util']:.3f} S {snap['best_S']:.3f} U {snap['best_U']:.5f} "
                      f"D {snap['best_D']:.3f} | {snap['best']}", flush=True)
            if checkpoint and isl.gens % (log_every * 50) == 0:
                checkpoint(isl, log)
        el = time.time() - t0
        if (seconds is not None and el >= seconds) or (gens is not None and isl.gens >= gens):
            break
    isl.update_hof()
    return isl, log


def hof_arrays(isl):
    ks = list(isl.hof.keys())
    G = np.array([isl.hof[k][2] for k in ks])
    st = np.array([isl.hof[k][0] / isl.hof[k][1] for k in ks])
    n = np.array([isl.hof[k][1] for k in ks])
    return G, st, n


def deep_eval(G, lives=200_000, chunk=25_000, seed=999, world=WORLD_NOMINAL):
    """Évaluation de haute précision + distributions (revenus, délai pour 10 k€, patrimoine)."""
    rng = np.random.default_rng(seed)
    G = np.asarray(G, dtype=np.int64)
    sums = np.zeros((len(G), NM))
    t10 = np.zeros((len(G), T_MONTHS + 2))
    parts = {k: [[] for _ in range(len(G))] for k in ("i12", "i24", "i60", "logw")}
    done = 0
    while done < lives:
        m = min(chunk, lives - done)
        U, Z, UI, ZI = draw_randoms(rng, m)
        out = evaluate(G, U, Z, UI, ZI, ENG, SEC, np.asarray(world, dtype=np.float64))
        sums += out.sum(1)
        for i in range(len(G)):
            t = out[i, :, M_T10K].astype(int)
            t10[i] += np.bincount(t, minlength=T_MONTHS + 2)[:T_MONTHS + 2]
            for k, c in (("i12", M_I12), ("i24", M_I24), ("i60", M_I60), ("logw", M_LOGW)):
                parts[k][i].append(out[i, :, c])
        done += m
    res = []
    qs = [0.1, 0.25, 0.5, 0.75, 0.9, 0.99]
    for i in range(len(G)):
        st = sums[i] / lives
        r = {"strategie": describe(G[i]), "stats": {k: float(v) for k, v in zip(METRIC_NAMES, st)},
             "utilite": float(utility(st[None])[0]), "vies": int(lives)}
        for k in parts:
            v = np.concatenate(parts[k][i])
            r[k + "_quantiles"] = {str(q): float(np.quantile(v, q)) for q in qs}
        r["p10k_cumul_par_mois"] = [float(x) for x in np.cumsum(t10[i][1:T_MONTHS + 1]) / lives]
        res.append(r)
    return res


def perturbed_world(rng):
    w = WORLD_NOMINAL.copy()
    z = rng.standard_normal(len(w))
    for i in range(len(w)):
        w[i] = WORLD_SIGMA[i] * z[i] if i in ADDITIVE else float(np.exp(WORLD_SIGMA[i] * z[i]))
    return w


def save(name, obj):
    os.makedirs(RES, exist_ok=True)
    tmp = os.path.join(RES, name + ".tmp")
    with open(tmp, "w") as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, os.path.join(RES, name))


def pick_candidates(G, st, n_util=40):
    ut = utility(st)
    cand = list(np.argsort(-ut)[:n_util])
    for w in [(0.8, 0.1, 0.1), (0.1, 0.8, 0.1), (0.1, 0.1, 0.8), (0.34, 0.33, 0.33), (0.6, 0.0, 0.4)]:
        cand += list(np.argsort(-utility(st, w))[:6])
    # diversité : la meilleure stratégie de chaque parcours distinct parmi les 300 premières
    seen = set()
    for i in np.argsort(-ut)[:300]:
        p = path_name(G[i])
        if p not in seen:
            seen.add(p)
            cand.append(i)
        if len(seen) >= 25:
            break
    return sorted(set(int(c) for c in cand))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["main", "locked", "robust"])
    ap.add_argument("--islands", type=int, default=48)
    ap.add_argument("--pop", type=int, default=96)
    ap.add_argument("--M", type=int, default=16)
    ap.add_argument("--nmax", type=int, default=512)
    ap.add_argument("--seconds", type=float, default=None)
    ap.add_argument("--gens", type=int, default=None)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--deep", type=int, default=300_000)
    ap.add_argument("--worlds", type=int, default=24)
    ap.add_argument("--engines", type=str, default="")
    a = ap.parse_args()
    T0 = time.time()

    if a.mode == "main":
        def ckpt(isl, log):
            save(f"v2_main{a.seed}_checkpoint.json", {"gens": isl.gens, "lives": isl.lives, "log": log[-200:]})
        isl, log = run_islands(a.islands, a.pop, a.M, a.nmax, a.seed, seconds=a.seconds, gens=a.gens,
                               label=f"main{a.seed}", checkpoint=ckpt)
        uniq = isl.unique_count()
        G, st, n = hof_arrays(isl)
        cand = pick_candidates(G, st)
        print(f"évaluation profonde de {len(cand)} candidates × {a.deep} vies...", flush=True)
        deep = deep_eval(G[cand], lives=a.deep)
        deep.sort(key=lambda r: -r["utilite"])
        save(f"v2_main{a.seed}.json", {"params": vars(a), "generations_par_ile": isl.gens, "iles": a.islands,
                                       "generations_total": isl.gens * a.islands, "lives": int(isl.lives),
                                       "lives_deep": len(cand) * a.deep, "unique": uniq,
                                       "seconds": time.time() - T0, "log": log, "final": deep,
                                       "hof_size": len(isl.hof)})
        print(f"terminé : {isl.gens} gén. × {a.islands} îles, {isl.lives / 1e9:.2f} Md vies, {uniq:,} stratégies uniques")

    elif a.mode == "locked":
        engines = [int(x) for x in a.engines.split(",")] if a.engines else list(range(NE))
        path = os.path.join(RES, "v2_locked.json")
        out = json.load(open(path)) if os.path.exists(path) else {"engines": {}, "lives": 0, "generations": 0}
        for e in engines:
            isl, log = run_islands(a.islands, a.pop, a.M, a.nmax, a.seed + e, lock=e, gens=a.gens,
                                   label=ENGINES_SHORT[e], verbose=False, log_every=20)
            G, st, n = hof_arrays(isl)
            if len(G) == 0:
                keys = [isl.key(g) for g in isl.P]
                G, st = isl.P, isl.means(keys)
            ut = utility(st)
            cand = sorted(set([int(i) for i in np.argsort(-ut)[:3]] + [int(np.argmax(st[:, M_S])),
                                                                         int(np.argmax(st[:, M_PUNI])),
                                                                         int(np.argmax(st[:, M_DUR2]))]))
            deep = deep_eval(G[cand], lives=a.deep, seed=777 + e)
            deep.sort(key=lambda r: -r["utilite"])
            out["engines"][str(e)] = {"moteur": ENGINES_SHORT[e], "lives": int(isl.lives + len(cand) * a.deep),
                                      "generations": isl.gens * a.islands, "final": deep,
                                      "unique": isl.unique_count()}
            out["lives"] = int(sum(v["lives"] for v in out["engines"].values()))
            out["generations"] = int(sum(v["generations"] for v in out["engines"].values()))
            save("v2_locked.json", out)
            s = deep[0]["stats"]
            print(f"== {ENGINES_SHORT[e]:24s} util {deep[0]['utilite']:+.3f} | ≤12m {s['p10k_12m']:.4f} "
                  f"≤24m {s['p10k_24m']:.4f} ≤60m {s['p10k_60m']:.4f} | part {s['part_temps_10k_3_10ans']:.3f} "
                  f"| lic {s['p_licorne']:.5f} | ab {s['p_abandon']:.2f} cata {s['p_catastrophe']:.2f} "
                  f"| {deep[0]['strategie']['parcours']}", flush=True)

    else:
        rng = np.random.default_rng(a.seed + 1000)
        worlds, total, gens_total = [], 0, 0
        for k in range(a.worlds):
            w = perturbed_world(rng)
            isl, log = run_islands(a.islands, a.pop, a.M, a.nmax, a.seed + 100 + k, world=w, gens=a.gens,
                                   label=f"monde{k}", verbose=False, log_every=25)
            G, st, n = hof_arrays(isl)
            if len(G) == 0:
                keys = [isl.key(g) for g in isl.P]
                G, st = isl.P, isl.means(keys)
            top = [int(i) for i in np.argsort(-utility(st))[:5]]
            deep = deep_eval(G[top], lives=a.deep, world=w, seed=50 + k)
            deep.sort(key=lambda r: -r["utilite"])
            total += isl.lives + 5 * a.deep
            gens_total += isl.gens * a.islands
            worlds.append({"world": [float(x) for x in w], "lives": int(isl.lives), "top": deep})
            print(f"== monde {k}: {deep[0]['strategie']['parcours']} util {deep[0]['utilite']:.3f}", flush=True)
            save("v2_robust.json", {"params": vars(a), "lives": int(total), "generations": int(gens_total),
                                    "seconds": time.time() - T0, "worlds": worlds})
