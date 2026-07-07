const Joi=require('joi');

const registerValidation=(data)=>{
    const schema=Joi.object({
        username:Joi.string().min(3).max(50).required(),
        email:Joi.string().min(6).max(50).required().email(),
        password:Joi.string().min(6).max(255).required(),
        role:Joi.string().required().valid('buyer','seller'),
    });

    return schema.validate(data);
};

const loginValidation=(data)=>{
    const schema=Joi.object({
        email:Joi.string().min(6).max(50).required().email(),
        password:Joi.string().min(6).max(255).required(),
    })

    return schema.validate(data);
};

const productValidation=(data)=>{
    const schema=Joi.object({
        title:Joi.string().min(6).max(50).required(),
        description:Joi.string().max(255).allow("").optional(),
        price:Joi.number().min(10).max(9999).required(),
        type:Joi.string().min(3).max(50).required(),
    })
    return schema.validate(data);    
};

module.exports.registerValidation=registerValidation;
module.exports.loginValidation=loginValidation;
module.exports.productValidation=productValidation;
