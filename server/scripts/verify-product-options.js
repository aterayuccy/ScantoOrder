const assert = require("node:assert/strict");
const {
  ProductOptionError,
  normalizeOptionGroups,
  normalizeSpecialRequestConfig,
  validateConfiguredPrice,
  buildOrderCustomization,
} = require("../product-options");
const Product = require("../models/product-model");

const IDS = {
  firstStep: "111111111111111111111111",
  secondStep: "222222222222222222222222",
  firstA: "aaaaaaaaaaaaaaaaaaaaaaaa",
  firstB: "bbbbbbbbbbbbbbbbbbbbbbbb",
  secondA: "cccccccccccccccccccccccc",
  secondB: "dddddddddddddddddddddddd",
  unknown: "eeeeeeeeeeeeeeeeeeeeeeee",
};

const makeProduct = (overrides = {}) => ({
  price: 150,
  optionGroups: [
    {
      _id: IDS.firstStep,
      name: "第一個調整步驟",
      // 複選步驟可同時選擇多個種類。
      selectionType: "multiple",
      required: true,
      maxSelections: 9,
      options: [
        {
          _id: IDS.firstA,
          name: "標準內容",
          priceAdjustment: 0,
        },
        {
          _id: IDS.firstB,
          name: "升級內容",
          priceAdjustment: 30,
        },
      ],
    },
    {
      _id: IDS.secondStep,
      name: "第二個調整步驟",
      selectionType: "single",
      required: false,
      maxSelections: 1,
      options: [
        {
          _id: IDS.secondA,
          name: "折抵內容",
          priceAdjustment: -10,
        },
        {
          _id: IDS.secondB,
          name: "加價內容",
          priceAdjustment: 20,
        },
      ],
    },
  ],
  specialRequestConfig: {
    enabled: true,
    label: "備註或特殊需求",
    maxLength: 20,
  },
  ...overrides,
});

const expectOptionError = (callback, message, messagePattern) => {
  assert.throws(
    callback,
    (error) => {
      assert.ok(error instanceof ProductOptionError);
      if (messagePattern) assert.match(error.message, messagePattern);
      return true;
    },
    message
  );
};

const tests = [];

const test = (name, callback) => {
  tests.push({ name, callback });
};

test("accepts zero effective steps, drops the note, and uses base price", () => {
  assert.deepEqual(normalizeOptionGroups([]), []);

  const result = buildOrderCustomization(
    makeProduct({ optionGroups: [] }),
    [],
    "不應保留的備註"
  );

  assert.deepEqual(result.selectedOptions, []);
  assert.equal(result.specialRequest, "");
  assert.equal(result.unitPrice, 150);

  const emptyStep = normalizeOptionGroups([
    {
      _id: IDS.firstStep,
      name: "尚未設定內容的步驟",
      options: [],
    },
  ]);
  const emptyStepResult = buildOrderCustomization(
    makeProduct({ optionGroups: emptyStep }),
    [{ groupId: String(emptyStep[0]._id), optionIds: [] }],
    "也不應保留"
  );
  assert.deepEqual(emptyStepResult.selectedOptions, []);
  assert.equal(emptyStepResult.specialRequest, "");
  assert.equal(emptyStepResult.unitPrice, 150);
});

test("preserves the store-selected single or multiple choice mode", () => {
  const groups = normalizeOptionGroups(
    JSON.stringify([
      {
        _id: IDS.firstStep,
        name: "熟度或其他自訂步驟",
        selectionType: "multiple",
        required: true,
        maxSelections: 8,
        options: [
          {
            _id: IDS.firstA,
            name: "店家自訂內容",
            priceAdjustment: "",
          },
        ],
      },
    ])
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "熟度或其他自訂步驟");
  assert.equal(groups[0].selectionType, "multiple");
  assert.equal(groups[0].required, false);
  assert.equal(groups[0].maxSelections, 1);
  assert.equal(groups[0].options[0].priceAdjustment, 0);
});

test("keeps legacy schema fields compatible while defaulting new steps", () => {
  const product = new Product({
    title: "測試品項",
    price: 100,
    type: "測試分類",
    optionGroups: [
      {
        name: "新步驟",
        options: [{ name: "未填金額" }],
      },
      {
        name: "舊資料步驟",
        selectionType: "multiple",
        required: true,
        maxSelections: 3,
        options: [{ name: "舊內容", priceAdjustment: 10 }],
      },
    ],
  });

  assert.equal(product.optionGroups[0].selectionType, "single");
  assert.equal(product.optionGroups[0].required, false);
  assert.equal(product.optionGroups[0].maxSelections, 1);
  assert.equal(product.optionGroups[0].options[0].priceAdjustment, 0);
  assert.equal(product.optionGroups[1].selectionType, "multiple");
  assert.equal(product.optionGroups[1].required, true);
  assert.equal(product.optionGroups[1].maxSelections, 3);
  assert.equal(product.validateSync(), undefined);
});

test("requires names but permits a step with no clickable content", () => {
  expectOptionError(
    () => normalizeOptionGroups([{ name: "", options: [{ name: "內容" }] }]),
    "blank step names must be rejected",
    /步驟名稱/
  );
  const emptyStep = normalizeOptionGroups([{ name: "空步驟", options: [] }]);
  assert.equal(emptyStep.length, 1);
  assert.deepEqual(emptyStep[0].options, []);
  expectOptionError(
    () =>
      normalizeOptionGroups([
        {
          name: "內容名稱檢查",
          options: [{ name: "", priceAdjustment: 0 }],
        },
      ]),
    "blank content names must be rejected",
    /可點內容名稱/
  );
});

test("treats every legacy required step as optional", () => {
  const result = buildOrderCustomization(
    makeProduct(),
    [
      { groupId: IDS.firstStep, optionIds: [] },
      { groupId: IDS.secondStep, optionIds: [] },
    ],
    ""
  );

  assert.deepEqual(result.selectedOptions, []);
  assert.equal(result.unitPrice, 150);
});

test("allows multiple contents in a multiple-choice step", () => {
  const result = buildOrderCustomization(
    makeProduct(),
    [
      {
        groupId: IDS.firstStep,
        optionIds: [IDS.firstA, IDS.firstB],
      },
    ],
    ""
  );
  assert.equal(result.selectedOptions.length, 2);
  assert.equal(result.unitPrice, 180);
});

test("rejects unknown steps and unknown clickable content", () => {
  expectOptionError(
    () =>
      buildOrderCustomization(
        makeProduct(),
        [{ groupId: IDS.firstStep, optionIds: [IDS.unknown] }],
        ""
      ),
    "unknown content must be rejected",
    /無效的可點內容/
  );
  expectOptionError(
    () =>
      buildOrderCustomization(
        makeProduct(),
        [{ groupId: IDS.unknown, optionIds: [] }],
        ""
      ),
    "unknown steps must be rejected",
    /不存在的調整步驟/
  );
});

test("calculates price only from the stored product content", () => {
  const result = buildOrderCustomization(
    makeProduct(),
    [
      {
        groupId: IDS.firstStep,
        optionIds: [IDS.firstB],
        priceAdjustment: -9999,
      },
      {
        groupId: IDS.secondStep,
        optionIds: [IDS.secondA],
      },
    ],
    ""
  );

  assert.equal(result.unitPrice, 170);
  assert.deepEqual(
    result.selectedOptions.map((option) => option.priceAdjustment),
    [30, -10]
  );
});

test("does not include a special request in the price", () => {
  const withoutRequest = buildOrderCustomization(
    makeProduct(),
    [{ groupId: IDS.firstStep, optionIds: [IDS.firstB] }],
    ""
  );
  const withRequest = buildOrderCustomization(
    makeProduct(),
    [{ groupId: IDS.firstStep, optionIds: [IDS.firstB] }],
    "  分開包裝，不計價  "
  );

  assert.equal(withRequest.unitPrice, withoutRequest.unitPrice);
  assert.equal(withRequest.specialRequest, "分開包裝，不計價");
});

test("allows a zero total and rejects a selected discount below zero", () => {
  const discountProduct = makeProduct({
    price: 20,
    optionGroups: [
      {
        _id: IDS.firstStep,
        name: "折抵步驟",
        selectionType: "multiple",
        required: true,
        maxSelections: 10,
        options: [
          {
            _id: IDS.firstA,
            name: "全額折抵",
            priceAdjustment: -20,
          },
          {
            _id: IDS.firstB,
            name: "超額折抵",
            priceAdjustment: -21,
          },
        ],
      },
    ],
  });

  const zeroTotal = buildOrderCustomization(
    discountProduct,
    [{ groupId: IDS.firstStep, optionIds: [IDS.firstA] }],
    ""
  );
  assert.equal(zeroTotal.unitPrice, 0);

  expectOptionError(
    () =>
      buildOrderCustomization(
        discountProduct,
        [{ groupId: IDS.firstStep, optionIds: [IDS.firstB] }],
        ""
      ),
    "a selected discount must not make the price negative"
  );
});

test("rejects seller settings whose worst one-per-step discount is negative", () => {
  const groups = normalizeOptionGroups([
    {
      name: "第一個優惠步驟",
      options: [
        { name: "折抵 30", priceAdjustment: -30 },
        { name: "折抵 10", priceAdjustment: -10 },
      ],
    },
    {
      name: "第二個優惠步驟",
      options: [
        { name: "折抵 20", priceAdjustment: -20 },
        { name: "加價 10", priceAdjustment: 10 },
      ],
    },
  ]);

  validateConfiguredPrice(50, groups);
  expectOptionError(
    () => validateConfiguredPrice(49, groups),
    "the largest discount from each optional step must be considered"
  );
});

test("enforces special-request configuration without affecting options", () => {
  const config = normalizeSpecialRequestConfig(
    JSON.stringify({
      enabled: true,
      label: "店家自訂備註",
      maxLength: 5,
    })
  );
  assert.deepEqual(config, {
    enabled: true,
    label: "店家自訂備註",
    maxLength: 5,
  });

  const product = makeProduct({ specialRequestConfig: config });
  const accepted = buildOrderCustomization(product, [], "12345");
  assert.equal(accepted.specialRequest, "12345");

  expectOptionError(
    () => buildOrderCustomization(product, [], "123456"),
    "special requests above maxLength must be rejected"
  );
});

test("builds stable keys and separates different choices or requests", () => {
  const product = makeProduct();
  const first = buildOrderCustomization(
    product,
    [
      { groupId: IDS.firstStep, optionIds: [IDS.firstB] },
      { groupId: IDS.secondStep, optionIds: [IDS.secondA] },
    ],
    "  同一備註  "
  );
  const reordered = buildOrderCustomization(
    {
      ...product,
      optionGroups: [...product.optionGroups].reverse(),
    },
    [
      { groupId: IDS.secondStep, optionIds: [IDS.secondA] },
      { groupId: IDS.firstStep, optionIds: [IDS.firstB] },
    ],
    "同一備註"
  );
  const differentChoice = buildOrderCustomization(
    product,
    [
      { groupId: IDS.firstStep, optionIds: [IDS.firstA] },
      { groupId: IDS.secondStep, optionIds: [IDS.secondA] },
    ],
    "同一備註"
  );
  const differentRequest = buildOrderCustomization(
    product,
    [
      { groupId: IDS.firstStep, optionIds: [IDS.firstB] },
      { groupId: IDS.secondStep, optionIds: [IDS.secondA] },
    ],
    "另一個備註"
  );

  assert.equal(first.selectionKey, reordered.selectionKey);
  assert.notEqual(first.selectionKey, differentChoice.selectionKey);
  assert.notEqual(first.selectionKey, differentRequest.selectionKey);
});

let passed = 0;

for (const { name, callback } of tests) {
  try {
    callback();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(`Product option verification passed: ${passed}/${tests.length}`);
