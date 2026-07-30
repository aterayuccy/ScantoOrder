const mongoose = require("mongoose");

const MAX_GROUPS = 10;
const MAX_OPTIONS_PER_GROUP = 30;
const MAX_SPECIAL_REQUEST_LENGTH = 300;

class ProductOptionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProductOptionError";
  }
}

const parseJsonField = (value, fallback, fieldName) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    throw new ProductOptionError(`${fieldName} 格式不正確`);
  }
};

const cleanText = (value, fieldName, maxLength) => {
  const text = String(value ?? "").trim();
  if (!text) throw new ProductOptionError(`${fieldName}不可空白`);
  if (text.length > maxLength) {
    throw new ProductOptionError(`${fieldName}不可超過 ${maxLength} 個字`);
  }
  return text;
};

const normalizePriceAdjustment = (value) => {
  const number = Number(
    value === undefined || value === null || String(value).trim() === ""
      ? 0
      : value
  );
  if (!Number.isInteger(number) || number < -9999 || number > 9999) {
    throw new ProductOptionError(
      "可點內容的加價／折抵須為 -9999 到 9999 的整數"
    );
  }
  return number;
};

const keepObjectId = (target, source) => {
  if (source?._id && mongoose.isValidObjectId(source._id)) {
    target._id = source._id;
  }
  return target;
};

const normalizeOptionGroups = (rawGroups) => {
  const groups = parseJsonField(rawGroups, [], "調整步驟");
  if (!Array.isArray(groups)) {
    throw new ProductOptionError("調整步驟必須是陣列");
  }
  if (groups.length > MAX_GROUPS) {
    throw new ProductOptionError(`調整步驟最多 ${MAX_GROUPS} 步`);
  }

  const seenGroupIds = new Set();
  return groups.map((rawGroup, groupIndex) => {
    if (rawGroup?._id && mongoose.isValidObjectId(rawGroup._id)) {
      const groupId = String(rawGroup._id);
      if (seenGroupIds.has(groupId)) {
        throw new ProductOptionError("調整步驟 ID 不可重複");
      }
      seenGroupIds.add(groupId);
    }

    const groupName = cleanText(
      rawGroup?.name,
      `第 ${groupIndex + 1} 個步驟名稱`,
      40
    );
    const selectionType =
      rawGroup?.selectionType === "multiple" ? "multiple" : "single";
    const options = Array.isArray(rawGroup?.options) ? rawGroup.options : [];

    if (options.length > MAX_OPTIONS_PER_GROUP) {
      throw new ProductOptionError(
        `${groupName}最多 ${MAX_OPTIONS_PER_GROUP} 個可點內容`
      );
    }

    const seenNames = new Set();
    const seenOptionIds = new Set();
    const normalizedOptions = options.map((rawOption, optionIndex) => {
      if (rawOption?._id && mongoose.isValidObjectId(rawOption._id)) {
        const optionId = String(rawOption._id);
        if (seenOptionIds.has(optionId)) {
          throw new ProductOptionError(`${groupName}內的可點內容 ID 不可重複`);
        }
        seenOptionIds.add(optionId);
      }

      const optionName = cleanText(
        rawOption?.name,
        `${groupName}第 ${optionIndex + 1} 個可點內容名稱`,
        50
      );
      const comparableName = optionName.toLocaleLowerCase("zh-TW");
      if (seenNames.has(comparableName)) {
        throw new ProductOptionError(`${groupName}內不可有重複的可點內容`);
      }
      seenNames.add(comparableName);

      return keepObjectId(
        {
          name: optionName,
          priceAdjustment: normalizePriceAdjustment(rawOption?.priceAdjustment),
        },
        rawOption
      );
    });

    return keepObjectId(
      {
        name: groupName,
        selectionType,
        required: false,
        maxSelections:
          selectionType === "multiple" ? normalizedOptions.length : 1,
        options: normalizedOptions,
      },
      rawGroup
    );
  });
};

const normalizeSpecialRequestConfig = (rawConfig) => {
  const config = parseJsonField(
    rawConfig,
    {
      enabled: true,
      label: "備註或特殊需求",
      maxLength: 200,
    },
    "備註設定"
  );

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new ProductOptionError("備註設定格式不正確");
  }

  const maxLength = Number(config.maxLength ?? 200);
  if (
    !Number.isInteger(maxLength) ||
    maxLength < 1 ||
    maxLength > MAX_SPECIAL_REQUEST_LENGTH
  ) {
    throw new ProductOptionError(
      `備註字數須介於 1 到 ${MAX_SPECIAL_REQUEST_LENGTH}`
    );
  }

  return {
    enabled: config.enabled !== false,
    label: cleanText(config.label || "備註或特殊需求", "備註欄名稱", 40),
    maxLength,
  };
};

const normalizeProductOptions = (body = {}) => ({
  optionGroups: normalizeOptionGroups(body.optionGroups),
  specialRequestConfig: normalizeSpecialRequestConfig(
    body.specialRequestConfig
  ),
});

const validateConfiguredPrice = (basePrice, optionGroups = []) => {
  const price = Number(basePrice);
  const minimumAdjustment = optionGroups.reduce((total, group) => {
    const adjustments = (group.options || []).map((option) =>
      Number(option.priceAdjustment || 0)
    );
    const lowestAdjustment =
      group.selectionType === "multiple"
        ? adjustments.reduce(
            (sum, adjustment) =>
              Number.isFinite(adjustment) && adjustment < 0
                ? sum + adjustment
                : sum,
            0
          )
        : adjustments.reduce(
            (lowest, adjustment) => Math.min(lowest, adjustment),
            0
          );

    // 單選取最低一個折抵；複選則計入所有可能同時選到的折抵。
    return total + lowestAdjustment;
  }, 0);

  if (!Number.isFinite(price) || price + minimumAdjustment < 0) {
    throw new ProductOptionError(
      "折抵設定可能讓品項價格低於 0，請調整折抵金額"
    );
  }
};

const buildOrderCustomization = (
  product,
  rawSelections = [],
  rawSpecialRequest = ""
) => {
  if (
    rawSelections !== undefined &&
    rawSelections !== null &&
    !Array.isArray(rawSelections)
  ) {
    throw new ProductOptionError("調整步驟選擇格式不正確");
  }

  const selections = rawSelections || [];
  const selectionsByGroup = new Map();
  const seenSelectionGroupIds = new Set();
  const allProductGroups = product.optionGroups || [];
  const productGroups = allProductGroups.filter(
    (group) => Array.isArray(group.options) && group.options.length > 0
  );
  const inactiveGroupIds = new Set(
    allProductGroups
      .filter(
        (group) => !Array.isArray(group.options) || group.options.length === 0
      )
      .map((group) => String(group._id))
  );

  for (const selection of selections) {
    const groupId = String(selection?.groupId || "");
    if (!groupId || seenSelectionGroupIds.has(groupId)) {
      throw new ProductOptionError("調整步驟選擇格式不正確");
    }
    seenSelectionGroupIds.add(groupId);
    const optionIds = Array.isArray(selection.optionIds)
      ? [...new Set(selection.optionIds.map(String))]
      : [];
    if (inactiveGroupIds.has(groupId)) {
      if (optionIds.length > 0) {
        throw new ProductOptionError("無效步驟不可包含可點內容");
      }
      continue;
    }
    selectionsByGroup.set(groupId, optionIds);
  }

  const selectedOptions = [];
  const signature = [];

  for (const group of productGroups) {
    const groupId = String(group._id);
    const selectedIds = selectionsByGroup.get(groupId) || [];
    selectionsByGroup.delete(groupId);

    if (group.selectionType !== "multiple" && selectedIds.length > 1) {
      throw new ProductOptionError(`「${group.name}」最多選擇一個可點內容`);
    }

    const optionsById = new Map(
      (group.options || []).map((option) => [String(option._id), option])
    );

    for (const optionId of selectedIds) {
      const option = optionsById.get(optionId);
      if (!option) {
        throw new ProductOptionError(`「${group.name}」包含無效的可點內容`);
      }
      selectedOptions.push({
        groupId,
        groupName: group.name,
        optionId,
        optionName: option.name,
        priceAdjustment: Number(option.priceAdjustment || 0),
      });
    }

    signature.push([groupId, [...selectedIds].sort()]);
  }

  if (selectionsByGroup.size > 0) {
    throw new ProductOptionError("選擇內容包含不存在的調整步驟");
  }

  const requestConfig = product.specialRequestConfig || {};
  const specialRequest =
    productGroups.length > 0 ? String(rawSpecialRequest || "").trim() : "";
  const maxLength = Number(requestConfig.maxLength || 200);

  if (requestConfig.enabled === false && specialRequest) {
    throw new ProductOptionError("此品項未開放備註");
  }
  if (specialRequest.length > maxLength) {
    throw new ProductOptionError(`備註不可超過 ${maxLength} 個字`);
  }

  const basePrice = Number(product.price || 0);
  const adjustmentTotal = selectedOptions.reduce(
    (sum, option) => sum + Number(option.priceAdjustment || 0),
    0
  );
  const unitPrice = basePrice + adjustmentTotal;
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 99999) {
    throw new ProductOptionError("調整後價格不正確");
  }

  return {
    selectedOptions,
    specialRequest,
    unitPrice,
    selectionKey: JSON.stringify([
      signature.sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
      specialRequest,
    ]),
  };
};

module.exports = {
  MAX_GROUPS,
  MAX_OPTIONS_PER_GROUP,
  ProductOptionError,
  normalizeOptionGroups,
  normalizeProductOptions,
  normalizeSpecialRequestConfig,
  validateConfiguredPrice,
  buildOrderCustomization,
};
