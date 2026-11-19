"""
Évolution génétique multi-objectif (NSGA-II) des stratégies d'enrichissement.

À chaque génération :
  1. on tire de nouveaux « destins » aléatoires (talent, chance, marchés...) ;
  2. on fabrique des enfants par tournoi + croisement + mutation ;
  3. chaque stratégie (parents + enfants) vit ces mêmes destins ;
  4. on garde les meilleures (non-dominées sur 3 objectifs), les autres meurent.

Objectifs maximisés :
  S = vitesse vers 10 k€/mois (moyenne de 2^(-mois/12), 0 si jamais atteint ; gains d'une fraude saisis)
  U = probabilité de bâtir une entreprise valorisée ≥ 1 milliard de dollars
  D = probabilité de gagner encore ≥ 10 k€/mois à 5 ans (pérennité)
Contrainte : risque de catastrophe judiciaire ≤ 2 %.
"""
import argparse
import json
import os
import time
import numpy as np

from model import (evaluate, draw_randoms, NG, NM, GENE_CARD, METRIC_NAMES, GENE_NAMES,
                   G_E1, G_E2, G_E3, G_THR12, G_DL12, G_THR23, G_DL23, G_SECTOR, G_CHANNEL,
                   G_CONTENT, G_PRICE, G_HOURS, G_LEARN, G_REINV, G_FUND, G_RAISE, G_GEO,
                   G_COF, G_NICHE, G_KEEP, M_S, M_PUNI, M_DUR, M_CAT, M_I12, M_I24, M_I60,
                   M_T10K, M_LOGW, M_VAL, M_DUR2, E_AGENCY, E_FREE, E_MICRO, E_DEEPTECH, E_JOB, E_CLOSER,
                   E_CONTENT, E_TRADING, E_FRAUD, E_ECOM, E_INFO, E_CONSUMER, E_FINTECH, T_MONTHS)
from params import ENG, SEC, WORLD_NOMINAL, ENGINES_SHORT, SECTORS, CHANNELS, GENE_LABELS

ORDINAL = np.zeros(NG, dtype=bool)
ORDINAL[[G_THR12, G_DL12, G_THR23, G_DL23, G_CONTENT, G_PRICE, G_HOURS, G_LEARN, G_REINV,
         G_RAISE, G_FUND, G_GEO]] = True
WORLD_SIGMA = np.array([0.3, 0.5, 0.3, 0.5, 0.4, 0.3, 0.5, 0.4, 0.5, 0.4, 0.5, 0.3, 0.004, 0.5])
RES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
DUR = [M_DUR]  # objectif de pérennité : M_DUR (≥ 10 k€ autour de 5 ans) ou M_DUR2 (part du temps ≥ 10 k€ de 3 à 10 ans)


def is_prod(e):
    return E_MICRO <= e <= E_DEEPTECH


def path_of(g):
    p = [int(g[G_E1])]
    for e in (int(g[G_E2]), int(g[G_E3])):
        if e != p[-1]:
            p.append(e)
    return p


def canonicalize(G):
    """Met à zéro les gènes sans effet, pour que deux stratégies identiques en pratique soient reconnues."""
    G = G.copy()
    for g in G:
        if g[G_THR12] == 0 and g[G_DL12] == 8 and g[G_E2] != g[G_E1]:
            g[G_E2] = g[G_E1]
            g[G_E3] = g[G_E1]
        if g[G_E2] == g[G_E1]:
            g[G_THR12], g[G_DL12] = 0, 8
        if g[G_THR23] == 0 and g[G_DL23] == 8 and g[G_E3] != g[G_E2]:
            g[G_E3] = g[G_E2]
        if g[G_E3] == g[G_E2]:
            g[G_THR23], g[G_DL23] = 0, 8
        path = path_of(g)
        has_prod = any(is_prod(e) for e in path)
        if not has_prod:
            g[G_FUND] = 0
            if g[G_COF] == 1:
                g[G_COF] = 0
            if g[G_GEO] in (1, 2):
                g[G_GEO] = 0
        if g[G_FUND] == 0:
            g[G_RAISE] = 0
        keep_ok = any(path[i] == E_AGENCY and is_prod(path[i + 1]) for i in range(len(path) - 1))
        if not keep_ok:
            g[G_KEEP] = 0
        uses_channel = any(e in (E_FREE, E_AGENCY, E_INFO) or is_prod(e) for e in path)
        if not uses_channel:
            g[G_CHANNEL] = 0
        uses_sector = any(e in (E_AGENCY, E_JOB, E_FREE) or (is_prod(e) and e not in (E_CONSUMER, E_FINTECH))
                          for e in path)
        if not uses_sector:
            g[G_SECTOR] = 0
        if all(e in (E_JOB, E_FRAUD, E_CONTENT) for e in path):
            g[G_PRICE] = 0
        uses_reinv = any(e in (E_AGENCY, E_ECOM, E_INFO) or is_prod(e) for e in path)
        if not uses_reinv:
            g[G_REINV] = 0
    return G


def key(g):
    return g.astype(np.int8).tobytes()


class Cache:
    def __init__(self):
        self.d = {}
        self.lives = 0
        self.unique = 0

    def add(self, G, out):
        sums = out.sum(1)
        for g, s in zip(G, sums):
            k = key(g)
            if k in self.d:
                self.d[k][0] += s
                self.d[k][1] += out.shape[1]
            else:
                self.d[k] = [s.copy(), out.shape[1]]
                self.unique += 1
        self.lives += out.shape[0] * out.shape[1]

    def n(self, g):
        v = self.d.get(key(g))
        return 0 if v is None else v[1]

    def means(self, G):
        return np.array([self.d[key(g)][0] / self.d[key(g)][1] for g in G])

    def counts(self, G):
        return np.array([self.d[key(g)][1] for g in G])


def objectives(st):
    F = np.stack([st[:, M_S], np.log10(st[:, M_PUNI] + 1e-7), st[:, DUR[0]]], 1)
    viol = np.maximum(0.0, st[:, M_CAT] - 0.02)
    return F, viol


def utility(st, w=(0.45, 0.30, 0.25)):
    us = np.clip((np.log10(st[:, M_PUNI] + 1e-7) + 5.0) / 3.0, 0.0, 1.0)
    return w[0] * st[:, M_S] + w[1] * us + w[2] * st[:, DUR[0]] - 3.0 * np.maximum(0.0, st[:, M_CAT] - 0.01)


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


def tournament(rng, rank, cd, n):
    a = rng.integers(0, len(rank), n)
    b = rng.integers(0, len(rank), n)
    better = (rank[a] < rank[b]) | ((rank[a] == rank[b]) & (cd[a] > cd[b]))
    return np.where(better, a, b)


def vary(rng, P, rank, cd, n, lock=None, p_imm=0.03):
    pa = P[tournament(rng, rank, cd, n)]
    pb = P[tournament(rng, rank, cd, n)]
    C = pa.copy()
    cx = rng.random(n) < 0.9
    mask = (rng.random((n, NG)) < 0.5) & cx[:, None]
    C[mask] = pb[mask]
    block = rng.random(n) < 0.3  # on transmet parfois tout le « parcours » (phases) d'un seul parent
    C[block, :7] = pb[block, :7]
    pm = 1.5 / NG
    mut = rng.random((n, NG)) < pm
    step = rng.random((n, NG)) < 0.7
    rnd = rng.integers(0, GENE_CARD, size=(n, NG))
    delta = np.where(rng.random((n, NG)) < 0.5, -1, 1)
    stepped = np.clip(C + delta, 0, GENE_CARD - 1)
    C = np.where(mut & step & ORDINAL[None, :], stepped, np.where(mut, rnd, C))
    imm = rng.random(n) < p_imm
    C[imm] = rng.integers(0, GENE_CARD, size=(imm.sum(), NG))
    if lock is not None:
        C[:, G_E1] = C[:, G_E2] = C[:, G_E3] = lock
    return canonicalize(C)


def unique_rows(G):
    _, idx = np.unique(G, axis=0, return_index=True)
    return G[np.sort(idx)]


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
        "secteur": SECTORS[g[G_SECTOR]], "canal": CHANNELS[g[G_CHANNEL]],
        "part de temps en contenu": GENE_LABELS["content"][g[G_CONTENT]],
        "niveau de prix": GENE_LABELS["price"][g[G_PRICE]], "heures/semaine": GENE_LABELS["hours"][g[G_HOURS]],
        "temps d'apprentissage": GENE_LABELS["learn"][g[G_LEARN]],
        "réinvestissement des bénéfices": GENE_LABELS["reinv"][g[G_REINV]],
        "financement": GENE_LABELS["fund"][g[G_FUND]], "déclencheur de levée": GENE_LABELS["raise"][g[G_RAISE]],
        "géographie": GENE_LABELS["geo"][g[G_GEO]], "associé": GENE_LABELS["cof"][g[G_COF]],
        "positionnement": GENE_LABELS["niche"][g[G_NICHE]], "garder l'agence": GENE_LABELS["keep"][g[G_KEEP]],
    })
    return d


def summary(st):
    return {k: float(v) for k, v in zip(METRIC_NAMES, st)}


def run_ga(pop=400, gens=1000, M=256, seed=1, world=WORLD_NOMINAL, lock=None, log_every=1, nmax_mult=8,
           label="", verbose=True, init=None):
    rng = np.random.default_rng(seed)
    cache = Cache()
    P = canonicalize(rng.integers(0, GENE_CARD, size=(pop, NG)))
    if lock is not None:
        P[:, :3] = lock
        P = canonicalize(P)
    if init is not None:
        P[:len(init)] = canonicalize(np.asarray(init))
    P = unique_rows(P)
    U, Z, UI, ZI = draw_randoms(rng, M)
    cache.add(P, evaluate(P, U, Z, UI, ZI, ENG, SEC, world))
    st = cache.means(P)
    F, viol = objectives(st)
    rank = nd_sort(F, viol)
    cd = crowding(F, rank)
    log = []
    t0 = time.time()
    nmax = nmax_mult * M
    for gen in range(gens):
        U, Z, UI, ZI = draw_randoms(rng, M)
        C = vary(rng, P, rank, cd, pop, lock=lock)
        allg = unique_rows(np.vstack([P, C]))
        need = np.array([cache.n(g) < nmax for g in allg])
        E = allg[need]
        if len(E):
            cache.add(E, evaluate(E, U, Z, UI, ZI, ENG, SEC, world))
        st = cache.means(allg)
        F, viol = objectives(st)
        rank_all = nd_sort(F, viol)
        cd_all = crowding(F, rank_all)
        order = np.lexsort((-cd_all, rank_all))[:pop]
        P = allg[order]
        st = st[order]
        rank = rank_all[order]
        cd = cd_all[order]
        if gen % log_every == 0 or gen == gens - 1:
            cnt = cache.counts(P)
            ok = cnt >= 2 * M
            ut = utility(st)
            ut_ok = np.where(ok, ut, -9)
            b = int(np.argmax(ut_ok))
            paths = {}
            for g in P:
                pn = path_name(g)
                paths[pn] = paths.get(pn, 0) + 1
            top = sorted(paths.items(), key=lambda x: -x[1])[:12]
            e1 = np.bincount(P[:, G_E1], minlength=15) / len(P)
            entry = {
                "gen": gen, "t": round(time.time() - t0, 1), "vies": int(cache.lives),
                "strategies_uniques": int(cache.unique), "front0": int((rank == 0).sum()),
                "best_util": float(ut_ok[b]), "best": path_name(P[b]), "best_genome": [int(x) for x in P[b]],
                "best_S": float(st[ok, M_S].max()) if ok.any() else 0.0,
                "best_U": float(st[ok, M_PUNI].max()) if ok.any() else 0.0,
                "best_D": float(st[ok, DUR[0]].max()) if ok.any() else 0.0,
                "mean_util": float(ut.mean()), "mean_S": float(st[:, M_S].mean()),
                "mean_U": float(st[:, M_PUNI].mean()), "mean_D": float(st[:, DUR[0]].mean()),
                "paths": top, "e1_share": [float(x) for x in e1],
            }
            log.append(entry)
            if verbose and (gen % (log_every * 25) == 0 or gen == gens - 1):
                print(f"[{label}] gén {gen:5d} | {entry['t']:7.1f}s | {cache.lives/1e6:8.1f} M vies | "
                      f"{cache.unique:7d} strat. | util {entry['best_util']:.3f} S {entry['best_S']:.3f} "
                      f"U {entry['best_U']:.5f} D {entry['best_D']:.3f} | {entry['best']}", flush=True)
    return P, st, rank, cache, log


def archive_top(cache, M, k=40, min_mult=4):
    keys = [kk for kk, v in cache.d.items() if v[1] >= min_mult * M]
    G = np.array([np.frombuffer(kk, dtype=np.int8).astype(np.int64) for kk in keys])
    st = np.array([cache.d[kk][0] / cache.d[kk][1] for kk in keys])
    return G, st


def deep_eval(G, lives=100_000, chunk=20_000, seed=999, world=WORLD_NOMINAL):
    """Évaluation de haute précision + distributions (revenus, délai pour 10 k€, patrimoine)."""
    rng = np.random.default_rng(seed)
    sums = np.zeros((len(G), NM))
    t10 = np.zeros((len(G), T_MONTHS + 2))
    inc_q = {k: [] for k in ("i12", "i24", "i60", "logw")}
    parts = {k: [[] for _ in range(len(G))] for k in inc_q}
    done = 0
    while done < lives:
        m = min(chunk, lives - done)
        U, Z, UI, ZI = draw_randoms(rng, m)
        out = evaluate(G, U, Z, UI, ZI, ENG, SEC, world)
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
        r = {"strategie": describe(G[i]), "stats": summary(st), "utilite": float(utility(st[None])[0])}
        for k in parts:
            v = np.concatenate(parts[k][i])
            r[k + "_quantiles"] = {str(q): float(np.quantile(v, q)) for q in qs}
        cum = np.cumsum(t10[i][1:T_MONTHS + 1]) / lives
        r["p10k_cumul_par_mois"] = [float(x) for x in cum]
        res.append(r)
    return res


def perturbed_world(rng):
    w = WORLD_NOMINAL.copy()
    z = rng.standard_normal(len(w))
    for i in range(len(w)):
        if i == 12:
            w[i] = WORLD_SIGMA[i] * z[i]
        else:
            w[i] = float(np.exp(WORLD_SIGMA[i] * z[i]))
    return w


def save(name, obj):
    os.makedirs(RES, exist_ok=True)
    with open(os.path.join(RES, name), "w") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["main", "locked", "robust"])
    ap.add_argument("--pop", type=int, default=400)
    ap.add_argument("--gens", type=int, default=1000)
    ap.add_argument("--M", type=int, default=256)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--worlds", type=int, default=24)
    ap.add_argument("--deep", type=int, default=100_000)
    ap.add_argument("--dur2", action="store_true", help="pérennité = part du temps ≥ 10 k€/mois entre 3 et 10 ans")
    a = ap.parse_args()
    if a.dur2:
        DUR[0] = M_DUR2
    T0 = time.time()

    if a.mode == "main":
        P, st, rank, cache, log = run_ga(a.pop, a.gens, a.M, a.seed, label=f"main{a.seed}", log_every=1)
        Ga, sta = archive_top(cache, a.M)
        ut = utility(sta)
        cand = list(np.argsort(-ut)[:30])
        for w in [(0.8, 0.1, 0.1), (0.1, 0.8, 0.1), (0.1, 0.1, 0.8), (0.34, 0.33, 0.33)]:
            cand += list(np.argsort(-utility(sta, w))[:5])
        F, viol = objectives(sta)
        rk = nd_sort(F, viol)
        cand += list(np.where(rk == 0)[0][:40])
        cand = sorted(set(int(c) for c in cand))
        G = Ga[cand]
        print(f"évaluation profonde de {len(G)} candidates × {a.deep} vies...", flush=True)
        deep = deep_eval(G, lives=a.deep)
        deep.sort(key=lambda r: -r["utilite"])
        save(f"main_seed{a.seed}{'_dur2' if a.dur2 else ''}.json", {"params": vars(a), "lives": int(cache.lives + len(G) * a.deep),
                                          "unique": int(cache.unique), "seconds": time.time() - T0,
                                          "log": log, "final": deep})
        print(f"terminé en {time.time()-T0:.0f}s ; {cache.lives/1e6:.1f} M vies (+{len(G)*a.deep/1e6:.1f} M en éval. profonde)")

    elif a.mode == "locked":
        out = []
        total = 0
        for e in range(15):
            P, st, rank, cache, log = run_ga(a.pop, a.gens, a.M, a.seed + e, lock=e, label=ENGINES_SHORT[e],
                                             log_every=5)
            Ga, sta = archive_top(cache, a.M)
            ut = utility(sta)
            best = [int(i) for i in np.argsort(-ut)[:3]]
            bs = int(np.argmax(sta[:, M_S]))
            bu = int(np.argmax(sta[:, M_PUNI]))
            G = Ga[sorted(set(best + [bs, bu]))]
            deep = deep_eval(G, lives=a.deep // 2)
            deep.sort(key=lambda r: -r["utilite"])
            total += cache.lives + len(G) * a.deep // 2
            out.append({"moteur": ENGINES_SHORT[e], "lives": int(cache.lives), "final": deep,
                        "log": log[::4]})
            print(f"== {ENGINES_SHORT[e]} : util {deep[0]['utilite']:.3f} | 10k≤12m {deep[0]['stats']['p10k_12m']:.3f}"
                  f" ≤24m {deep[0]['stats']['p10k_24m']:.3f} | licorne {deep[0]['stats']['p_licorne']:.5f}", flush=True)
        save("locked.json", {"params": vars(a), "lives": int(total), "seconds": time.time() - T0, "engines": out})

    else:  # robust
        rng = np.random.default_rng(a.seed + 1000)
        worlds = []
        total = 0
        for k in range(a.worlds):
            w = perturbed_world(rng)
            P, st, rank, cache, log = run_ga(a.pop, a.gens, a.M, a.seed + 100 + k, world=w, label=f"monde{k}",
                                             log_every=10, verbose=True)
            Ga, sta = archive_top(cache, a.M)
            ut = utility(sta)
            top = [int(i) for i in np.argsort(-ut)[:5]]
            deep = deep_eval(Ga[top], lives=20_000, world=w)
            deep.sort(key=lambda r: -r["utilite"])
            total += cache.lives + 5 * 20_000
            worlds.append({"world": [float(x) for x in w], "lives": int(cache.lives), "top": deep,
                           "best_util_curve": [e["best_util"] for e in log]})
            print(f"== monde {k}: {deep[0]['strategie']['parcours']} util {deep[0]['utilite']:.3f}", flush=True)
            save("robust.json", {"params": vars(a), "lives": int(total), "seconds": time.time() - T0, "worlds": worlds})
