import React, { useMemo } from "react";

const formatAdjustment = (value) => {
  const adjustment = Number(value || 0);
  if (adjustment === 0) return "";

  const formatted = Math.abs(adjustment).toLocaleString("zh-TW", {
    maximumFractionDigits: 2,
  });
  return `${adjustment > 0 ? "+" : "-"} NT$ ${formatted}`;
};

const ProductSelectionSummary = ({
  selectedOptions = [],
  specialRequest = "",
  noteLabel = "備註或特殊需求",
  className = "",
}) => {
  const groupedOptions = useMemo(() => {
    const groups = [];
    const groupIndexes = new Map();

    (Array.isArray(selectedOptions) ? selectedOptions : []).forEach(
      (option, optionIndex) => {
        const optionName = String(option?.optionName || "").trim();
        if (!optionName) return;

        const groupName = String(option?.groupName || "").trim() || "品項調整";
        let groupIndex = groupIndexes.get(groupName);

        if (groupIndex === undefined) {
          groupIndex = groups.length;
          groupIndexes.set(groupName, groupIndex);
          groups.push({ name: groupName, options: [] });
        }

        groups[groupIndex].options.push({
          name: optionName,
          priceAdjustment: Number(option?.priceAdjustment || 0),
          key: String(
            option?.optionId ??
              option?._id ??
              `${groupName}-${optionName}-${optionIndex}`
          ),
        });
      }
    );

    return groups;
  }, [selectedOptions]);

  const normalizedRequest = String(specialRequest || "").trim();
  if (groupedOptions.length === 0 && !normalizedRequest) return null;

  return (
    <div
      className={`product-selection-summary${className ? ` ${className}` : ""}`}
    >
      {groupedOptions.map((group) => (
        <div key={group.name} className="product-selection-summary__group">
          <span className="product-selection-summary__group-name">
            {group.name}
          </span>
          <ul className="product-selection-summary__option-list">
            {group.options.map((option) => {
              const adjustment = formatAdjustment(option.priceAdjustment);

              return (
                <li
                  key={option.key}
                  className="product-selection-summary__option"
                >
                  <span>{option.name}</span>
                  {adjustment && (
                    <span className="product-selection-summary__adjustment">
                      {adjustment}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {normalizedRequest && (
        <div className="product-selection-summary__note">
          <span className="product-selection-summary__note-label">
            {String(noteLabel || "備註或特殊需求")}
          </span>
          <p className="product-selection-summary__note-text">
            {normalizedRequest}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductSelectionSummary;
