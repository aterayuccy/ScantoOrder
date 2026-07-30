const USERNAME_PATTERN = /^[\p{Script=Han}A-Za-z0-9_]+$/u;
const MIN_USERNAME_LENGTH = 2;
const MAX_USERNAME_LENGTH = 20;

const normalizeUsername = (value) =>
  String(value || "")
    .normalize("NFKC")
    .trim();

const getUsernameLength = (value) => Array.from(value).length;

const isValidUsername = (value) => {
  const normalized = normalizeUsername(value);
  const length = getUsernameLength(normalized);

  return (
    length >= MIN_USERNAME_LENGTH &&
    length <= MAX_USERNAME_LENGTH &&
    USERNAME_PATTERN.test(normalized)
  );
};

module.exports = {
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  USERNAME_PATTERN,
  getUsernameLength,
  isValidUsername,
  normalizeUsername,
};
