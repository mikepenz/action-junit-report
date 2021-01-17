package action.surefire.report.calc;

import static java.math.BigDecimal.ZERO;
import static java.math.RoundingMode.HALF_EVEN;

import java.math.BigDecimal;

public final class CalcUtils {

    private CalcUtils() {
        // utility class
    }

    /**
     * Rounds value to 4 decimal places
     */
    public static BigDecimal roundPercentageValue(BigDecimal value) {
        return value.setScale(4, HALF_EVEN);
    }

    public static boolean equalTo(BigDecimal value1, BigDecimal value2) {
        return value1.compareTo(value2) == 0;
    }

    public static boolean greaterThanEqualTo(BigDecimal value1, BigDecimal value2) {
        return value1.compareTo(value2) >= 0;
    }

    public static BigDecimal positiveOrZero(BigDecimal value) {
        return greaterThanEqualTo(value, ZERO) ? value : ZERO;
    }

    /**
     * @return zero if divisor is 0
     */
    public static BigDecimal safeDivide(BigDecimal dividend, BigDecimal divisor,
            int decimalPlaces) {
        if (equalTo(divisor, ZERO)) {
            return ZERO;
        } else {
            return dividend.divide(divisor, decimalPlaces, HALF_EVEN);
        }
    }

    /**
     * Scales amount to 2 decimal places, throwing error if decimal places overflow
     */
    public static BigDecimal scaleAmount(BigDecimal amount) {
        if (!(amount.stripTrailingZeros().scale() <= 2)) {
            throw new IllegalArgumentException("Amount must have max 2 non-zero decimal places");
        }
        return amount.stripTrailingZeros().setScale(2, HALF_EVEN);
    }

    public static BigDecimal nullToZero(BigDecimal value) {
        if (value != null) {
            return value;
        } else {
            return ZERO;
        }
    }
}
