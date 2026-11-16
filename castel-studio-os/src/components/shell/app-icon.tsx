// Shared artwork for generated PNG icons (next/og ImageResponse).
export function AppIconArt({ size }: { size: number }) {
  const s = size;
  return (
    <div style={{ width: s, height: s, background: "#0a0a0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: s * 0.62, height: s * 0.62, borderRadius: s * 0.16, border: `${Math.max(2, s * 0.02)}px solid #c9a44c`,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#e2c478", fontSize: s * 0.36, fontWeight: 700, fontFamily: "serif",
        }}
      >
        C
      </div>
    </div>
  );
}
