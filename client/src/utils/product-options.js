const DEFAULT_STEP_NAMES = ["內容調整", "口味調整", "加購"];
const MAX_STEPS = 10;
const MAX_OPTIONS_PER_STEP = 30;

let clientIdSequence = 0;

const createClientId = (prefix) => {
  clientIdSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${clientIdSequence.toString(36)}`;
};

const toInteger = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

const createOption = ({ label = "", priceDelta = 0 } = {}) => ({
  id: createClientId("option"),
  label,
  priceDelta,
});

const createOptionGroup = ({
  label = "其他調整",
  selectionType = "single",
  options = [],
} = {}) => ({
  id: createClientId("group"),
  label,
  selectionType: selectionType === "multiple" ? "multiple" : "single",
  required: false,
  maxSelections: selectionType === "multiple" ? MAX_OPTIONS_PER_STEP : 1,
  options,
});

const getDefaultStepName = (index) =>
  DEFAULT_STEP_NAMES[index] || `步驟 ${index + 1}`;

const createDefaultOptionGroups = () =>
  DEFAULT_STEP_NAMES.map((label) => createOptionGroup({ label }));

const createDefaultSpecialRequestConfig = () => ({
  enabled: true,
  label: "備註或特殊需求",
  maxLength: 100,
});

const normalizeOptionGroups = (optionGroups) => {
  if (!Array.isArray(optionGroups)) {
    return [];
  }

  return optionGroups.slice(0, MAX_STEPS).map((group, groupIndex) => {
    const groupId = group?.id || group?._id || createClientId("group");
    const normalizedGroup = {
      id: String(groupId),
      label: String(
        group?.label ?? group?.name ?? getDefaultStepName(groupIndex)
      ).trim(),
      selectionType:
        group?.selectionType === "multiple" ? "multiple" : "single",
      required: false,
      maxSelections:
        group?.selectionType === "multiple" ? MAX_OPTIONS_PER_STEP : 1,
      options: Array.isArray(group?.options)
        ? group.options.slice(0, MAX_OPTIONS_PER_STEP).map((option) => {
            const optionId =
              option?.id || option?._id || createClientId("option");
            const normalizedOption = {
              id: String(optionId),
              label: String(option?.label ?? option?.name ?? "").trim(),
              priceDelta: toInteger(
                option?.priceDelta ?? option?.priceAdjustment,
                0
              ),
            };

            if (option?._id) {
              normalizedOption._id = String(option._id);
            }

            return normalizedOption;
          })
        : [],
    };

    if (group?._id) {
      normalizedGroup._id = String(group._id);
    }

    return normalizedGroup;
  });
};

const normalizeSpecialRequestConfig = (specialRequestConfig) => {
  const source = specialRequestConfig || {};

  return {
    enabled: Boolean(source.enabled),
    label: String(source.label ?? "備註或特殊需求").trim(),
    maxLength: Math.min(300, Math.max(1, toInteger(source.maxLength, 100))),
  };
};

const validateProductOptions = (
  optionGroups,
  specialRequestConfig = createDefaultSpecialRequestConfig(),
  basePrice
) => {
  const errors = [];
  const groups = Array.isArray(optionGroups) ? optionGroups : [];

  if (groups.length > MAX_STEPS) {
    errors.push({
      path: "optionGroups",
      message: `品項調整最多 ${MAX_STEPS} 個步驟`,
    });
  }

  groups.forEach((group, groupIndex) => {
    const stepPath = `optionGroups.${groupIndex}`;
    const stepLabel = String(group?.label ?? "").trim();
    const options = Array.isArray(group?.options) ? group.options : [];

    if (!stepLabel) {
      errors.push({
        path: `${stepPath}.label`,
        message: `第 ${groupIndex + 1} 個步驟需要名稱`,
      });
    } else if (stepLabel.length > 40) {
      errors.push({
        path: `${stepPath}.label`,
        message: `${stepLabel}的名稱不可超過 40 個字`,
      });
    }

    if (options.length > MAX_OPTIONS_PER_STEP) {
      errors.push({
        path: `${stepPath}.options`,
        message: `${stepLabel || `第 ${groupIndex + 1} 個步驟`}最多 ${MAX_OPTIONS_PER_STEP} 個內容`,
      });
    }

    const seenOptionLabels = new Set();

    options.forEach((option, optionIndex) => {
      const optionPath = `${stepPath}.options.${optionIndex}`;
      const optionLabel = String(option?.label ?? "").trim();
      const normalizedLabel = optionLabel.toLocaleLowerCase("zh-TW");
      const priceDelta = Number(
        option?.priceDelta === "" ? 0 : option?.priceDelta
      );

      if (!optionLabel) {
        errors.push({
          path: `${optionPath}.label`,
          message: `${stepLabel || `第 ${groupIndex + 1} 個步驟`}的第 ${optionIndex + 1} 個內容需要名稱`,
        });
      } else if (seenOptionLabels.has(normalizedLabel)) {
        errors.push({
          path: `${optionPath}.label`,
          message: `${stepLabel || `第 ${groupIndex + 1} 個步驟`}內不可有重複名稱「${optionLabel}」`,
        });
      } else {
        seenOptionLabels.add(normalizedLabel);
      }

      if (!Number.isInteger(priceDelta)) {
        errors.push({
          path: `${optionPath}.priceDelta`,
          message: `${optionLabel || `第 ${optionIndex + 1} 個內容`}的加價或折抵必須是整數`,
        });
      } else if (priceDelta < -9999 || priceDelta > 9999) {
        errors.push({
          path: `${optionPath}.priceDelta`,
          message: `${optionLabel || `第 ${optionIndex + 1} 個內容`}的加價或折抵須介於 -9999 到 9999`,
        });
      }
    });
  });

  const noteConfig = specialRequestConfig || {};
  if (groups.length > 0 && noteConfig.enabled) {
    if (!String(noteConfig.label ?? "").trim()) {
      errors.push({
        path: "specialRequestConfig.label",
        message: "開啟備註時需要填寫欄位名稱",
      });
    }

    const maxLength = Number(noteConfig.maxLength);
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 300) {
      errors.push({
        path: "specialRequestConfig.maxLength",
        message: "備註字數上限必須是 1 到 300 的整數",
      });
    }
  }

  const numericBasePrice = Number(basePrice);
  if (basePrice !== undefined && Number.isFinite(numericBasePrice)) {
    const minimumAdjustment = groups.reduce((total, group) => {
      const adjustments = (Array.isArray(group?.options) ? group.options : [])
        .map((option) =>
          Number(option?.priceDelta === "" ? 0 : option?.priceDelta)
        )
        .filter(Number.isFinite);
      const lowestStepAdjustment =
        group?.selectionType === "multiple"
          ? adjustments.reduce(
              (total, adjustment) =>
                adjustment < 0 ? total + adjustment : total,
              0
            )
          : adjustments.reduce(
              (lowest, adjustment) => Math.min(lowest, adjustment),
              0
            );

      return total + lowestStepAdjustment;
    }, 0);

    if (numericBasePrice + minimumAdjustment < 0) {
      errors.push({
        path: "optionGroups",
        message: "折抵設定可能讓品項價格低於 0，請調整折抵金額",
      });
    }
  }

  return {
    valid: errors.length === 0,
    isValid: errors.length === 0,
    errors,
  };
};

const formatPrice = (value) => {
  const amount = toInteger(value, 0);
  return `NT$ ${amount.toLocaleString("zh-TW")}`;
};

const formatPriceAdjustment = (value) => {
  const amount = toInteger(value, 0);

  if (amount === 0) {
    return "0 元";
  }

  const sign = amount > 0 ? "+" : "−";
  return `${sign}NT$ ${Math.abs(amount).toLocaleString("zh-TW")}`;
};

export {
  DEFAULT_STEP_NAMES,
  MAX_OPTIONS_PER_STEP,
  MAX_STEPS,
  createClientId,
  createDefaultOptionGroups,
  createDefaultSpecialRequestConfig,
  createOption,
  createOptionGroup,
  formatPrice,
  formatPriceAdjustment,
  getDefaultStepName,
  normalizeOptionGroups,
  normalizeSpecialRequestConfig,
  validateProductOptions,
};
