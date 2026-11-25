import {
  Activity, Bath, Bike, BookOpen, Briefcase, Brush, Building, Calculator, Camera, Car, CarFront, ChefHat, ClipboardList,
  Dog, Drill, Droplets, Dumbbell, Eye, Flame, Flower2, Gamepad2, Gem, GraduationCap, Guitar, Hand, HeartHandshake, House,
  KeyRound, Landmark, Languages, Laptop, Leaf, Monitor, Palette, PartyPopper, PawPrint, PenTool, PersonStanding, Puzzle,
  Ruler, Scale, Scissors, Shirt, Sofa, Sparkles, Store, Ticket, Truck, Utensils, Video, Wind, Wine, Wrench, Zap, Footprints,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/config/categories";

const ICONS: Record<IconName, LucideIcon> = {
  Activity, Bath, Bike, BookOpen, Briefcase, Brush, Building, Calculator, Camera, Car, CarFront, ChefHat, ClipboardList,
  Dog, Drill, Droplets, Dumbbell, Eye, Flame, Flower2, Gamepad2, Gem, GraduationCap, Guitar, Hand, HeartHandshake, House,
  KeyRound, Landmark, Languages, Laptop, Leaf, Monitor, Palette, PartyPopper, PawPrint, PenTool, PersonStanding, Puzzle,
  Ruler, Scale, Scissors, Shirt, Sofa, Sparkles, Store, Ticket, Truck, Utensils, Video, Wind, Wine, Wrench, Zap, Footprints,
};

export function CategoryIcon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  const Icon = ICONS[name] ?? Store;
  return <Icon className={className} aria-hidden />;
}
