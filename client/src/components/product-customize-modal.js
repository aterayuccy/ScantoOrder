import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_NOTE_LABEL = "備註或特殊需求";
const DEFAULT_NOTE_MAX_LENGTH = 200;

const getItemId = (item, fallback) => String(item?._id ?? item?.id ?? fallback);

const normalizeGroups = (optionGroups) =>
  (Array.isArray(optionGroups) ? optionGroups : [])
    .map((group, groupIndex) => {
      const options = (Array.isArray(group?.options) ? group.options : [])
        .map((option, optionIndex) => ({
          ...option,
          id: getItemId(option, `option-${groupIndex}-${optionIndex}`),
          name: String(option?.name ?? option?.label ?? "").trim(),
          priceAdjustment: Number(
            option?.priceAdjustment ?? option?.priceDelta ?? 0
          ),
        }))
        .filter((option) => option.name);

      return {
        ...group,
        id: getItemId(group, `group-${groupIndex}`),
        selectionType:
          group?.selectionType === "multiple" ? "multiple" : "single",
        name:
          String(group?.name ?? group?.label ?? "").trim() ||
          `步驟 ${groupIndex + 1}`,
        options,
      };
    })
    .filter((group) => group.options.length > 0);

const createEmptySelections = (groups) =>
  groups.reduce((selections, group) => {
    selections[group.id] =
      group.selectionType === "multiple" || !group.options[0]
        ? []
        : [group.options[0].id];
    return selections;
  }, {});

const formatPrice = (value) =>
  `NT$ ${Number(value || 0).toLocaleString("zh-TW", {
    maximumFractionDigits: 2,
  })}`;

const formatAdjustment = (value) => {
  const adjustment = Number(value || 0);
  if (adjustment === 0) return "0 元";
  return `${adjustment > 0 ? "+" : "−"} ${formatPrice(Math.abs(adjustment))}`;
};

const ProductCustomizeModal = ({
  product,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const groups = useMemo(
    () => normalizeGroups(product?.optionGroups),
    [product]
  );
  const [selectedByGroup, setSelectedByGroup] = useState({});
  const [quantity, setQuantity] = useState("1");
  const [specialRequest, setSpecialRequest] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  const requestConfig = product?.specialRequestConfig || {};
  const isNoteEnabled = groups.length > 0 && requestConfig.enabled !== false;
  const noteLabel = String(requestConfig.label || DEFAULT_NOTE_LABEL);
  const configuredNoteMaxLength = Number(requestConfig.maxLength);
  const noteMaxLength =
    Number.isInteger(configuredNoteMaxLength) &&
    configuredNoteMaxLength >= 1 &&
    configuredNoteMaxLength <= 300
      ? configuredNoteMaxLength
      : DEFAULT_NOTE_MAX_LENGTH;

  useEffect(() => {
    if (!isOpen) return;

    setSelectedByGroup(createEmptySelections(groups));
    setQuantity("1");
    setSpecialRequest("");
    setErrors({});
    setSubmitError("");
  }, [groups, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose?.();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  const handleOptionChange = (group, optionId) => {
    setSelectedByGroup((current) => ({
      ...current,
      [group.id]:
        group.selectionType === "multiple"
          ? (Array.isArray(current[group.id])
              ? current[group.id]
              : []
            ).includes(optionId)
            ? current[group.id].filter((id) => id !== optionId)
            : [
                ...(Array.isArray(current[group.id]) ? current[group.id] : []),
                optionId,
              ]
          : optionId
            ? [optionId]
            : [],
    }));
  };

  const handleQuantityChange = (event) => {
    const nextQuantity = event.target.value;
    const parsedQuantity = Number(nextQuantity);
    setQuantity(nextQuantity);

    setErrors((current) => ({
      ...current,
      quantity:
        Number.isInteger(parsedQuantity) &&
        parsedQuantity >= 1 &&
        parsedQuantity <= 99
          ? ""
          : "數量須為 1 至 99 的整數",
    }));
  };

  const handleSpecialRequestChange = (event) => {
    const nextRequest = event.target.value;
    setSpecialRequest(nextRequest);
    setErrors((current) => ({
      ...current,
      specialRequest:
        nextRequest.length > noteMaxLength
          ? `${noteLabel}不可超過 ${noteMaxLength} 個字`
          : "",
    }));
  };

  const getStepAdjustment = (group) => {
    const selectedIds = Array.isArray(selectedByGroup[group.id])
      ? selectedByGroup[group.id]
      : [];
    return group.options
      .filter((option) => selectedIds.includes(option.id))
      .reduce(
        (total, option) => total + Number(option.priceAdjustment || 0),
        0
      );
  };

  const selectedAdjustment = groups.reduce(
    (total, group) => total + getStepAdjustment(group),
    0
  );
  const basePrice = Number(product?.price || 0);
  const unitPrice = basePrice + selectedAdjustment;
  const parsedQuantity = Number(quantity);
  const validQuantity =
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1 &&
    parsedQuantity <= 99
      ? parsedQuantity
      : null;
  const baseTotal = validQuantity === null ? null : basePrice * validQuantity;
  const adjustmentTotal =
    validQuantity === null ? null : selectedAdjustment * validQuantity;
  const subtotal = validQuantity === null ? null : unitPrice * validQuantity;

  const validate = () => {
    const nextErrors = {
      quantity: validQuantity === null ? "數量須為 1 至 99 的整數" : "",
      specialRequest:
        isNoteEnabled && specialRequest.length > noteMaxLength
          ? `${noteLabel}不可超過 ${noteMaxLength} 個字`
          : "",
    };

    setErrors(nextErrors);
    return !nextErrors.quantity && !nextErrors.specialRequest;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setSubmitError("");
    try {
      await onConfirm?.({
        quantity: validQuantity,
        selections: groups.map((group) => {
          return {
            groupId: group.id,
            // 空陣列代表維持原品項設定，不會儲存成商品選項。
            optionIds: Array.isArray(selectedByGroup[group.id])
              ? selectedByGroup[group.id]
              : [],
          };
        }),
        specialRequest: isNoteEnabled ? specialRequest.trim() : "",
      });
    } catch (error) {
      setSubmitError(error?.message || "加入購物車失敗，請稍後再試");
    }
  };

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose?.();
    }
  };

  if (!isOpen || !product || groups.length === 0) return null;

  return (
    <div
      className="product-customize-modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        className="product-customize-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-customize-modal-title"
      >
        <header className="product-customize-modal__header">
          <div>
            <p className="product-customize-modal__eyebrow">調整品項</p>
            <h2
              id="product-customize-modal-title"
              className="product-customize-modal__title"
            >
              {product.title}
            </h2>
          </div>
          <button
            type="button"
            className="product-customize-modal__close"
            onClick={() => onClose?.()}
            disabled={isSubmitting}
            aria-label="關閉品項調整視窗"
          >
            ×
          </button>
        </header>

        <form
          className="product-customize-modal__form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="product-customize-modal__body">
            {groups.map((group, groupIndex) => {
              const selectedIds = Array.isArray(selectedByGroup[group.id])
                ? selectedByGroup[group.id]
                : [];
              const isMultiple = group.selectionType === "multiple";
              const stepAdjustment = getStepAdjustment(group);

              return (
                <fieldset
                  key={group.id}
                  className="product-customize-modal__group"
                >
                  <legend className="product-customize-modal__group-heading">
                    <span>
                      <small className="product-customize-modal__step-index">
                        步驟 {groupIndex + 1}
                      </small>
                      {group.name}
                    </span>
                    <span className="product-customize-modal__step-adjustment">
                      本步差額 {formatAdjustment(stepAdjustment)}
                    </span>
                  </legend>

                  <div className="product-customize-modal__options">
                    {isMultiple && (
                      <p className="product-customize-modal__selection-help">
                        可依需求勾選多個種類。
                      </p>
                    )}

                    {group.options.map((option) => (
                      <label
                        key={option.id}
                        className={`product-customize-modal__option${
                          selectedIds.includes(option.id)
                            ? " product-customize-modal__option--selected"
                            : ""
                        }`}
                      >
                        <input
                          type={isMultiple ? "checkbox" : "radio"}
                          name={`product-customize-${String(
                            product._id || product.id || "product"
                          )}-${group.id}`}
                          value={option.id}
                          checked={selectedIds.includes(option.id)}
                          onChange={() => handleOptionChange(group, option.id)}
                          disabled={isSubmitting}
                        />
                        <span className="product-customize-modal__option-name">
                          {option.name}
                        </span>
                        <span className="product-customize-modal__option-price">
                          {formatAdjustment(option.priceAdjustment)}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}

            {isNoteEnabled && (
              <div className="product-customize-modal__note-field">
                <div className="product-customize-modal__field-heading">
                  <label htmlFor="product-customize-special-request">
                    最後：{noteLabel}
                  </label>
                  <span>
                    {specialRequest.length}/{noteMaxLength}
                  </span>
                </div>
                <textarea
                  id="product-customize-special-request"
                  className="product-customize-modal__textarea"
                  value={specialRequest}
                  onChange={handleSpecialRequestChange}
                  maxLength={noteMaxLength}
                  rows="3"
                  placeholder={`請輸入${noteLabel}（選填）`}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.specialRequest)}
                  aria-describedby={
                    errors.specialRequest
                      ? "product-customize-special-request-error"
                      : undefined
                  }
                />
                {errors.specialRequest && (
                  <p
                    id="product-customize-special-request-error"
                    className="product-customize-modal__error"
                    role="alert"
                  >
                    {errors.specialRequest}
                  </p>
                )}
              </div>
            )}

            <div className="product-customize-modal__quantity-field">
              <label htmlFor="product-customize-quantity">數量</label>
              <input
                id="product-customize-quantity"
                className="product-customize-modal__quantity-input"
                type="number"
                min="1"
                max="99"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={handleQuantityChange}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.quantity)}
                aria-describedby={
                  errors.quantity
                    ? "product-customize-quantity-error"
                    : undefined
                }
              />
              {errors.quantity && (
                <p
                  id="product-customize-quantity-error"
                  className="product-customize-modal__error"
                  role="alert"
                >
                  {errors.quantity}
                </p>
              )}
            </div>
          </div>

          {submitError && (
            <p
              className="product-customize-modal__error product-customize-modal__submit-error"
              role="alert"
            >
              {submitError}
            </p>
          )}

          <footer className="product-customize-modal__footer">
            <div
              className="product-customize-modal__price-summary"
              aria-live="polite"
            >
              <span className="product-customize-modal__price-row">
                <span>原品項</span>
                <span>{baseTotal === null ? "—" : formatPrice(baseTotal)}</span>
              </span>
              <span className="product-customize-modal__price-row">
                <span>調整差額</span>
                <span>
                  {adjustmentTotal === null
                    ? "—"
                    : formatAdjustment(adjustmentTotal)}
                </span>
              </span>
              <strong className="product-customize-modal__price-row product-customize-modal__price-row--total">
                <span>調整後價格</span>
                <span>{subtotal === null ? "—" : formatPrice(subtotal)}</span>
              </strong>
            </div>
            <div className="product-customize-modal__actions">
              <button
                type="button"
                className="btn btn-outline-secondary product-customize-modal__cancel"
                onClick={() => onClose?.()}
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="submit"
                className="btn btn-primary product-customize-modal__confirm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "確認中…" : "確認"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default ProductCustomizeModal;
