package action.surefire.report.email;

import org.apache.commons.lang3.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

public class EmailAddress {

    private final String address;

    private static final Pattern EMAIL_PATTERN = Pattern.compile("" +
            "^" +
            "[a-z0-9!#$%&'*+/=?^_`{|}~-]+" + // non-greedy local part
            "(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*" + // non-greedy local part with dot
            "@" +
            "(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+" + // non-greedy domain with dot
            "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?" + // the rest of the domain
            "$"
    );

    public static EmailAddress of(String address) throws InvalidEmailAddressException {
        return new EmailAddress(address);
    }

    private EmailAddress(String address) {
        if (StringUtils.isBlank(address))
            throw new InvalidEmailAddressException("Email address must not be null, empty, or blanks");
        String normalized = address.toLowerCase(Locale.ENGLISH).trim();
        if (!EMAIL_PATTERN.matcher(normalized).matches())
            throw new InvalidEmailAddressException("Invalid email address '" + address + "'");
        this.address = normalized;
    }
}
