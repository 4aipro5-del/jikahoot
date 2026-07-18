type OverflowMode = "wrap" | "shrink";

type ResponsiveDisplayTitleProps = {
  as?: "h1" | "h2";
  leading: string;
  suffix?: string;
  overflowMode?: OverflowMode;
  className?: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ResponsiveDisplayTitle({
  as: Tag = "h1",
  leading,
  suffix,
  overflowMode = "wrap",
  className = "",
}: ResponsiveDisplayTitleProps) {
  return (
    <Tag
      className={joinClasses(
        "display-font",
        overflowMode === "wrap" ? "display-title-wrap" : "display-title-shrink",
        className,
      )}
      data-overflow-mode={overflowMode}
    >
      <span>{leading}</span>
      {suffix ? <span data-display-suffix="true">{suffix}</span> : null}
    </Tag>
  );
}
