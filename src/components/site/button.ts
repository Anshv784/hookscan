type Variant = "default" | "outline" | "ghost";
type Size = "default" | "sm" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background-color,border-color,color,filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";
const variants: Record<Variant, string> = {
  default: "bg-brand text-white shadow-[0_8px_24px_-10px_rgba(245,75,0,0.6)] hover:brightness-110",
  outline: "border border-border bg-card/60 text-foreground hover:border-line-strong hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
};
const sizes: Record<Size, string> = { default: "h-9 px-4 text-sm", sm: "h-8 px-3 text-sm", lg: "h-11 px-5 text-base" };

export function buttonVariants({
  variant = "default",
  size = "default",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}
