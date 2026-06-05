// Stand-Marker: zeigt Zeit + Datum des letzten Builds (statisch).
export default function DevClock() {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-xs shadow-lg backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="tabular-nums text-white/70">12:34</span>
        <span className="text-white/25">|</span>
        <span className="text-white/50">04.06.26</span>
      </div>
    </div>
  );
}
