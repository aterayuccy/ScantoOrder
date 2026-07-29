const Joi=require('joi');

const registerValidation=(data)=>{
    const schema=Joi.object({
        username:Joi.string()
            .trim()
            .min(3)
            .max(20)
            .pattern(/^[A-Za-z0-9_]+$/)
            .required()
            .messages({
                "string.empty": "請輸入使用者名稱",
                "string.min": "使用者名稱至少需要 3 個字元",
                "string.max": "使用者名稱最多只能有 20 個字元",
                "string.pattern.base": "使用者名稱只能包含英文字母、數字及底線",
                "any.required": "請輸入使用者名稱",
            }),
        password:Joi.string()
            .min(8)
            .max(64)
            .pattern(/^[\x20-\x7E]+$/)
            .pattern(/^(?=.*[A-Za-z])(?=.*\d).*$/)
            .required()
            .messages({
                "string.empty": "請輸入密碼",
                "string.min": "密碼至少需要 8 個字元",
                "string.max": "密碼最多只能有 64 個字元",
                "string.pattern.base": "密碼只能使用半形英文、數字及符號，且必須包含英文與數字",
                "any.required": "請輸入密碼",
            }),
        role:Joi.string().required().valid('buyer','seller'),
    });

    return schema.validate(data, { abortEarly: false });
};

const loginValidation=(data)=>{
    const schema=Joi.object({
        username:Joi.string()
            .trim()
            .min(3)
            .max(20)
            .pattern(/^[A-Za-z0-9_]+$/)
            .required()
            .messages({
                "string.empty": "請輸入使用者名稱",
                "string.min": "使用者名稱至少需要 3 個字元",
                "string.max": "使用者名稱最多只能有 20 個字元",
                "string.pattern.base": "使用者名稱只能包含英文字母、數字及底線",
                "any.required": "請輸入使用者名稱",
            }),
        password:Joi.string()
            .max(64)
            .pattern(/^[\x20-\x7E]+$/)
            .required()
            .messages({
                "string.empty": "請輸入密碼",
                "string.max": "密碼最多只能有 64 個字元",
                "string.pattern.base": "密碼只能使用半形英文、數字及符號",
                "any.required": "請輸入密碼",
            }),
    });

    return schema.validate(data, { abortEarly: false });
};

const productValidation=(data)=>{
    const schema=Joi.object({
        title:Joi.string().trim().min(1).max(50).required(),
        description:Joi.string().max(255).allow("").optional(),
        price:Joi.number().integer().min(0).max(9999).required(),
        type:Joi.string().trim().min(1).max(50).required(),
    })
    return schema.validate(data);    
};

module.exports.registerValidation=registerValidation;
module.exports.loginValidation=loginValidation;
module.exports.productValidation=productValidation;
