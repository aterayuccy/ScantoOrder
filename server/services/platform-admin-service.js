const User = require("../models/user-model");

const STORE_LIST_LIMIT = 200;

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listStores = async ({ query = "" } = {}) => {
  const normalizedQuery = String(query || "")
    .normalize("NFKC")
    .trim();
  const filter = { role: "seller" };
  if (normalizedQuery) {
    filter.username = {
      $regex: escapeRegExp(normalizedQuery),
      $options: "i",
    };
  }

  const [total, stores] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select("_id username createdAt")
      .sort({ createdAt: -1 })
      .limit(STORE_LIST_LIMIT)
      .lean(),
  ]);

  return {
    total,
    stores: stores.map((store) => ({
      id: store._id,
      username: store.username,
      createdAt: store.createdAt,
    })),
  };
};

module.exports = {
  STORE_LIST_LIMIT,
  listStores,
};
