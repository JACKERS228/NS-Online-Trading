// High-performance formatter cache to eliminate repeated Intl.NumberFormat instantiations
const formattersCache = new Map();

function getFormatter(key, options) {
  let formatter = formattersCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', options);
    formattersCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Fast currency & number formatting with symbol prefix (e.g. $100.00, §250.00)
 */
export function formatCurrencyValue(amount, {
  rate = 1.0,
  symbol = '$',
  currencyName = '',
  forceUSD = false,
  showSymbol = true,
  includeCurrencyName = false,
  includeCode = false,
  maximumFractionDigits = 2,
  compact = false
} = {}) {
  const num = Number(amount) || 0;

  if (forceUSD) {
    const isCompact = compact && Math.abs(num) >= 1000000;
    const maxFrac = Math.abs(num) < 0.01 && num !== 0 ? 4 : maximumFractionDigits;
    const cacheKey = `usd_${isCompact}_${maxFrac}`;
    
    const formatter = getFormatter(cacheKey, {
      notation: isCompact ? 'compact' : 'standard',
      minimumFractionDigits: Math.abs(num) < 1 && !isCompact ? 2 : 2,
      maximumFractionDigits: maxFrac
    });

    const formatted = formatter.format(num);
    const prefix = showSymbol ? '$' : '';
    const suffix = includeCode ? ' USD' : '';
    return `${prefix}${formatted}${suffix}`.trim();
  }

  const convertedVal = num * rate;
  const isCompact = compact && Math.abs(convertedVal) >= 1000000;
  const maxFrac = Math.abs(convertedVal) < 0.01 && convertedVal !== 0 ? 4 : maximumFractionDigits;
  const cacheKey = `custom_${isCompact}_${maxFrac}`;

  const formatter = getFormatter(cacheKey, {
    notation: isCompact ? 'compact' : 'standard',
    minimumFractionDigits: Math.abs(convertedVal) < 1 && !isCompact ? 2 : 2,
    maximumFractionDigits: maxFrac
  });

  const formatted = formatter.format(convertedVal);
  const prefix = showSymbol ? (symbol || '¤') : '';
  const suffix = includeCurrencyName && currencyName ? ` ${currencyName}` : '';

  return `${prefix}${formatted}${suffix}`.trim();
}

/**
 * Fast percentage formatter
 */
export function formatPercentage(val, maximumFractionDigits = 2) {
  const num = Number(val) || 0;
  const cacheKey = `pct_${maximumFractionDigits}`;
  const formatter = getFormatter(cacheKey, {
    minimumFractionDigits: 2,
    maximumFractionDigits
  });
  return formatter.format(num);
}
