/**
 * Babel configuration for the Expo app.
 * `babel-preset-expo` provides the React Native + Expo transform defaults.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
