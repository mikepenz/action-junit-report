package action.surefire.report.calc;

public final class StringUtils {

    private StringUtils() {
        // utility class
    }

    public static String nullIfBlank(String value) {
        if (org.apache.commons.lang3.StringUtils.isBlank(value)) {
            return null;
        }
        return value;
    }


    public static String requireNotBlank(String input) {
        return requireNotBlank(input, null);
    }

    public static String requireNotBlank(String input, String message) {
        if (!org.apache.commons.lang3.StringUtils.isBlank(input)) {
            return input;
        } else {
            throw new IllegalArgumentException(
                    message != null ? message : "Input='" + input + "' didn't match condition.");
        }
    }
}
