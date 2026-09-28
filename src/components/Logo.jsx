export default function Logo({ size = "md", className = "" }) {
  const sizes = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" };
  return (
    <div className={`inline-flex items-center gap-1.5 select-none ${className}`}>
      




      
      <span className={`font-display tracking-tighter leading-none ${sizes[size]}`}>
        <span className="text-black">STY</span>
        <span className="text-[#000000]">L</span>
        <span className="text-black">D</span>
      </span>
    </div>);

}