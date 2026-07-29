import React, { useEffect, useId, useState } from "react";

import {
  MAX_OPTIONS_PER_STEP,
  MAX_STEPS,
  createOption,
  createOptionGroup,
  getDefaultStepName,
} from "../utils/product-options";

const editorStyle = {
  width: "100%",
  marginTop: "2rem",
};

const sectionStyle = {
  padding: "1.25rem",
  border: "1px solid #dbe3ef",
  borderRadius: "0.75rem",
  background: "#f8fafc",
};

const stepCardStyle = {
  padding: "1rem",
  border: "1px solid #dbe3ef",
  borderRadius: "0.75rem",
  background: "#ffffff",
  boxShadow: "0 0.25rem 0.75rem rgba(15, 23, 42, 0.05)",
};

const wrappingRowStyle = {
  display: "flex",
  alignItems: "flex-end",
  flexWrap: "wrap",
  gap: "0.75rem",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  minWidth: 0,
};

const fieldLabelStyle = {
  color: "#374151",
  fontWeight: 700,
};

const helperTextStyle = {
  margin: "0.35rem 0 0",
  color: "#64748b",
  fontSize: "0.875rem",
  lineHeight: 1.5,
};

const toPriceDelta = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};

const toCount = (value, maximum) =>
  Math.min(maximum, Math.max(0, Math.trunc(Number(value) || 0)));

const ProductOptionsEditor = ({
  optionGroups,
  setOptionGroups,
  specialRequestConfig,
  setSpecialRequestConfig,
}) => {
  const idPrefix = useId().replace(/:/g, "");
  const groups = Array.isArray(optionGroups) ? optionGroups : [];
  const [stepCountDraft, setStepCountDraft] = useState(() =>
    String(groups.length)
  );
  const [optionCountDrafts, setOptionCountDrafts] = useState({});
  const noteConfig = specialRequestConfig || {
    enabled: false,
    label: "備註或特殊需求",
    maxLength: 100,
  };

  useEffect(() => {
    setStepCountDraft(String(groups.length));
  }, [groups.length]);

  const updateGroups = (updater) => {
    if (typeof setOptionGroups !== "function") return;
    setOptionGroups((current) =>
      updater(Array.isArray(current) ? current : [])
    );
  };

  const setStepCount = (nextCount) => {
    const count = toCount(nextCount, MAX_STEPS);

    updateGroups((current) => {
      if (count <= current.length) return current.slice(0, count);

      const nextGroups = [...current];
      while (nextGroups.length < count) {
        const stepIndex = nextGroups.length;
        nextGroups.push(
          createOptionGroup({ label: getDefaultStepName(stepIndex) })
        );
      }
      return nextGroups;
    });
  };

  const confirmStepCount = () => {
    const count = toCount(stepCountDraft, MAX_STEPS);
    setStepCountDraft(String(count));
    setStepCount(count);
  };

  const updateStep = (groupIndex, patch) => {
    updateGroups((current) =>
      current.map((group, index) => {
        if (index !== groupIndex) return group;
        const selectionType =
          patch.selectionType === "multiple" ||
          (patch.selectionType === undefined && group.selectionType === "multiple")
            ? "multiple"
            : "single";

        return {
          ...group,
          selectionType,
          required: false,
          maxSelections: selectionType === "multiple" ? MAX_OPTIONS_PER_STEP : 1,
          ...patch,
        };
      })
    );
  };

  const updateOption = (groupIndex, optionIndex, patch) => {
    updateGroups((current) =>
      current.map((group, index) => {
        if (index !== groupIndex) return group;

        const options = Array.isArray(group.options) ? group.options : [];
        return {
          ...group,
          options: options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex
              ? { ...option, ...patch }
              : option
          ),
        };
      })
    );
  };

  const setOptionCount = (groupIndex, nextCount) => {
    const count = toCount(nextCount, MAX_OPTIONS_PER_STEP);

    updateGroups((current) =>
      current.map((group, index) => {
        if (index !== groupIndex) return group;

        const options = Array.isArray(group.options) ? group.options : [];
        if (count <= options.length) {
          return { ...group, options: options.slice(0, count) };
        }

        const nextOptions = [...options];
        while (nextOptions.length < count) {
          nextOptions.push(createOption());
        }

        return {
          ...group,
          options: nextOptions,
        };
      })
    );
  };

  const confirmOptionCount = (groupIndex, groupKey, currentCount) => {
    const count = toCount(
      optionCountDrafts[groupKey] ?? currentCount,
      MAX_OPTIONS_PER_STEP
    );
    setOptionCountDrafts((current) => ({
      ...current,
      [groupKey]: String(count),
    }));
    setOptionCount(groupIndex, count);
  };

  const removeGroup = (groupIndex) => {
    updateGroups((current) =>
      current.filter((_, index) => index !== groupIndex)
    );
  };

  const removeOption = (groupIndex, optionIndex, groupKey) => {
    const currentCount = Array.isArray(groups[groupIndex]?.options)
      ? groups[groupIndex].options.length
      : 0;
    setOptionCountDrafts((current) => ({
      ...current,
      [groupKey]: String(Math.max(0, currentCount - 1)),
    }));
    updateGroups((current) =>
      current.map((group, index) => {
        if (index !== groupIndex) return group;

        return {
          ...group,
          options: (Array.isArray(group.options) ? group.options : []).filter(
            (_, currentOptionIndex) => currentOptionIndex !== optionIndex
          ),
        };
      })
    );
  };

  const updateSpecialRequestConfig = (patch) => {
    if (typeof setSpecialRequestConfig !== "function") return;
    setSpecialRequestConfig((current) => ({
      enabled: false,
      label: "備註或特殊需求",
      maxLength: 100,
      ...(current || {}),
      ...patch,
    }));
  };

  return (
    <section style={editorStyle} aria-labelledby={`${idPrefix}-editor-title`}>
      <div style={{ marginBottom: "1rem" }}>
        <h3
          id={`${idPrefix}-editor-title`}
          style={{ margin: "0 0 0.4rem", fontSize: "1.5rem" }}
        >
          品項調整步驟
        </h3>
        <p style={{ ...helperTextStyle, margin: 0 }}>
          在每個步驟內設定單選或複選，並新增顧客可選擇的種類與加價或折抵金額。
        </p>
      </div>

      <div style={{ ...sectionStyle, marginBottom: "1rem" }}>
        <div style={wrappingRowStyle}>
          <div style={{ ...fieldStyle, flex: "0 1 15rem" }}>
            <label htmlFor={`${idPrefix}-step-count`} style={fieldLabelStyle}>
              步驟數量
            </label>
            <div className="count-confirm-control">
              <input
                id={`${idPrefix}-step-count`}
                type="number"
                className="form-control"
                min="0"
                max={MAX_STEPS}
                step="1"
                inputMode="numeric"
                value={stepCountDraft}
                onChange={(event) => setStepCountDraft(event.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmStepCount}
              >
                確認
              </button>
            </div>
          </div>
          <p style={{ ...helperTextStyle, flex: "1 1 16rem" }}>
            調整數量後按「確認」才會套用。減少時會從最後一個步驟開始移除；設為 0 時，顧客會直接加入購物車。
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: "1rem",
        }}
      >
        {groups.map((group, groupIndex) => {
          const groupKey = group.id || group._id || `group-${groupIndex}`;
          const options = Array.isArray(group.options) ? group.options : [];
          const groupId = `${idPrefix}-group-${groupIndex}`;

          return (
            <div key={groupKey} style={stepCardStyle}>
              <div className="product-step-header">
                <h4
                  style={{
                    margin: 0,
                    color: "#1f2937",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                  }}
                >
                  步驟 {groupIndex + 1}
                </h4>
                <button
                  type="button"
                  className="btn btn-outline-danger product-remove-icon"
                  onClick={() => removeGroup(groupIndex)}
                  aria-label={`刪除步驟 ${groupIndex + 1}`}
                  title="刪除此步驟"
                >
                  ×
                </button>
              </div>

              <div style={wrappingRowStyle}>
                <fieldset
                  style={{
                    ...fieldStyle,
                    flex: "0 1 auto",
                    minWidth: "12rem",
                    margin: 0,
                    padding: 0,
                    border: 0,
                  }}
                >
                  <legend
                    style={{
                      margin: 0,
                      color: "#374151",
                      fontSize: "1rem",
                      fontWeight: 700,
                    }}
                  >
                    選擇方式
                  </legend>
                  <div style={{ display: "flex", gap: "0.9rem" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        color: "#374151",
                      }}
                    >
                      <input
                        type="radio"
                        name={`${groupId}-selection-type`}
                        checked={group.selectionType !== "multiple"}
                        onChange={() =>
                          updateStep(groupIndex, { selectionType: "single" })
                        }
                      />
                      單選
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        color: "#374151",
                      }}
                    >
                      <input
                        type="radio"
                        name={`${groupId}-selection-type`}
                        checked={group.selectionType === "multiple"}
                        onChange={() =>
                          updateStep(groupIndex, { selectionType: "multiple" })
                        }
                      />
                      複選
                    </label>
                  </div>
                </fieldset>

              </div>

              <section
                style={{
                  marginTop: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #e5e7eb",
                }}
                aria-label={`${group.label || `步驟 ${groupIndex + 1}`}的步驟種類`}
              >
                <div style={{ ...fieldStyle, width: "15rem", maxWidth: "100%" }}>
                  <label htmlFor={`${groupId}-option-count`} style={fieldLabelStyle}>
                    種類數量
                  </label>
                  <div className="count-confirm-control">
                    <input
                      id={`${groupId}-option-count`}
                      type="number"
                      className="form-control"
                      min="0"
                      max={MAX_OPTIONS_PER_STEP}
                      step="1"
                      inputMode="numeric"
                      value={optionCountDrafts[groupKey] ?? String(options.length)}
                      onChange={(event) =>
                        setOptionCountDrafts((current) => ({
                          ...current,
                          [groupKey]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() =>
                        confirmOptionCount(groupIndex, groupKey, options.length)
                      }
                    >
                      確認
                    </button>
                  </div>
                </div>

                {options.length === 0 ? (
                  <p style={helperTextStyle}>
                    將種類數量調高後，即可設定顧客可選擇的內容。
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr)",
                      gap: "0.75rem",
                      marginTop: "0.75rem",
                    }}
                  >
                    {options.map((option, optionIndex) => {
                      const optionKey =
                        option.id || option._id || `option-${optionIndex}`;
                      const optionId = `${groupId}-option-${optionIndex}`;

                      return (
                        <div key={optionKey} className="product-option-row">
                          <label
                            htmlFor={`${optionId}-label`}
                            style={{ ...fieldStyle, flex: "2 1 14rem" }}
                          >
                            <span style={fieldLabelStyle}>
                              種類 {optionIndex + 1}
                            </span>
                            <input
                              id={`${optionId}-label`}
                              type="text"
                              className="form-control"
                              value={option.label ?? ""}
                              maxLength={50}
                              placeholder="例如：大杯、五分熟"
                              onChange={(event) =>
                                updateOption(groupIndex, optionIndex, {
                                  label: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label
                            htmlFor={`${optionId}-price-delta`}
                            style={{ ...fieldStyle, flex: "1 1 11rem" }}
                          >
                            <span style={fieldLabelStyle}>加價／折抵</span>
                            <input
                              id={`${optionId}-price-delta`}
                              type="number"
                              className="form-control"
                              min="-9999"
                              max="9999"
                              step="1"
                              inputMode="numeric"
                              value={option.priceDelta ?? 0}
                              onChange={(event) =>
                                updateOption(groupIndex, optionIndex, {
                                  priceDelta: event.target.value,
                                })
                              }
                              onBlur={(event) =>
                                updateOption(groupIndex, optionIndex, {
                                  priceDelta: toPriceDelta(event.target.value),
                                })
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="btn btn-outline-danger product-remove-icon product-option-remove-icon"
                            onClick={() =>
                              removeOption(groupIndex, optionIndex, groupKey)
                            }
                            aria-label={`刪除種類 ${optionIndex + 1}`}
                            title="刪除此種類"
                          >
                            ×
                          </button>

                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div
          className="alert alert-info"
          style={{ marginTop: "1.5rem", marginBottom: 0 }}
        >
          目前為 0 個步驟。顧客會直接加入 1 份品項，調整視窗與備註不會顯示。
        </div>
      ) : (
        <section
          style={{ ...sectionStyle, marginTop: "1.5rem" }}
          aria-labelledby={`${idPrefix}-special-request-title`}
        >
          <div style={{ ...wrappingRowStyle, alignItems: "center" }}>
            <div style={{ flex: "1 1 16rem" }}>
              <h4
                id={`${idPrefix}-special-request-title`}
                style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}
              >
                最後：備註（不計價）
              </h4>
              <p style={{ ...helperTextStyle, margin: 0 }}>
                備註固定顯示在所有調整步驟之後，且不影響價格。
              </p>
            </div>

            <label
              htmlFor={`${idPrefix}-special-request-enabled`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                color: "#374151",
                fontWeight: 700,
              }}
            >
              <input
                id={`${idPrefix}-special-request-enabled`}
                type="checkbox"
                className="form-check-input"
                checked={Boolean(noteConfig.enabled)}
                onChange={(event) =>
                  updateSpecialRequestConfig({
                    enabled: event.target.checked,
                  })
                }
              />
              顯示備註
            </label>
          </div>

          {noteConfig.enabled && (
            <div style={{ ...wrappingRowStyle, marginTop: "1rem" }}>
              <label
                htmlFor={`${idPrefix}-special-request-label`}
                style={{ ...fieldStyle, flex: "2 1 16rem" }}
              >
                <span style={fieldLabelStyle}>顧客看到的欄位名稱</span>
                <input
                  id={`${idPrefix}-special-request-label`}
                  type="text"
                  className="form-control"
                  maxLength={40}
                  value={noteConfig.label ?? ""}
                  onChange={(event) =>
                    updateSpecialRequestConfig({ label: event.target.value })
                  }
                />
              </label>
            </div>
          )}
        </section>
      )}
    </section>
  );
};

export default ProductOptionsEditor;
