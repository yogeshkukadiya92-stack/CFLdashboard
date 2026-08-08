"use client";

type HeightInputProps = {
  className: string;
  onChange: (value: string) => void;
  value: string;
};

export function isHeightField(type: string, label: string) {
  return type === "height" || (type === "short_text" && label.trim().toLowerCase() === "height");
}

function parseHeight(value: string) {
  return {
    feet: value.match(/(\d+)\s*ft/i)?.[1] ?? "",
    inches: value.match(/(\d+)\s*in/i)?.[1] ?? ""
  };
}

function formatHeight(feet: string, inches: string) {
  if (!feet) return "";
  const normalizedInches = inches || "0";
  const centimeters = (Number(feet) * 12 + Number(normalizedInches)) * 2.54;
  return `${feet} ft ${normalizedInches} in | ${centimeters.toFixed(1)} cm`;
}

export function HeightInput({ className, onChange, value }: HeightInputProps) {
  const { feet, inches } = parseHeight(value);
  const centimeters = feet ? ((Number(feet) * 12 + Number(inches || 0)) * 2.54).toFixed(1) : "";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="block">
        <span className="sr-only">Feet</span>
        <select aria-label="Height in feet" className={`${className} appearance-none pr-12`} onChange={(event) => onChange(formatHeight(event.target.value, inches))} value={feet}>
          <option value="">Feet</option>
          {[2, 3, 4, 5, 6, 7, 8].map((option) => <option key={option} value={option}>{option} ft</option>)}
        </select>
      </label>
      <label className="block">
        <span className="sr-only">Inches</span>
        <select aria-label="Additional height in inches" className={`${className} appearance-none pr-12`} disabled={!feet} onChange={(event) => onChange(formatHeight(feet, event.target.value))} value={inches || (feet ? "0" : "")}>
          <option value="">Inches</option>
          {Array.from({ length: 12 }, (_, option) => <option key={option} value={option}>{option} in</option>)}
        </select>
      </label>
      <div className="col-span-2 flex min-h-[48px] items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 sm:col-span-1 sm:min-w-[126px] sm:justify-center">
        <span className="sm:hidden">Centimeters</span>
        <output aria-live="polite">{centimeters ? `${centimeters} cm` : "-- cm"}</output>
      </div>
    </div>
  );
}
