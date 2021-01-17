package action.surefire.report.email;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.fail;

import org.junit.Test;

public class EmailAddressTest {

    @Test
    public void shouldBeGoodEnoughForSalesforce() {
        EmailAddress.of("abcdefg.hijklmnopqrstuvwxyz!#$%&'*/=?^_+-`{|}~0123456789@host.com");
    }

    @Test
    public void shouldNotBeBlank() {
        expectException(null);
        expectException("");
        expectException("   ");
    }

    @Test
    public void shouldNotMissComponents() {
        expectException("user-without-host@test.com");
        expectException("@host-without-user");
        expectException("just-something-that-i-do-not-what-that-is");
    }

    @Test
    public void shouldNotContainLocalHosts() {
        expectException("user@host");
        expectException("user@localhost");
        expectException("user@whatever-without-a-tld");
    }

    @Test
    public void shouldNotContainInternationalizedHostNames() {
        expectException("user@ñandú.com.ar");
    }

    @Test
    public void shouldAcceptInternationalizedDomainNamesUsingPunycode() {
        EmailAddress.of("user@xn--and-6ma2c.com.ar");
    }

    @Test
    public void shouldBeStricterThanRfc2821() {
        expectException("Abc\\@def@example.com");
        expectException("Fred\\ Bloggs@example.com");
        expectException("Joe.\\Blow@example.com");
        expectException("\"Fred Bloggs\"@example.com");
    }

    @Test
    public void shouldBeStricterThanRfc2822() {
        expectException("aba@bab.com");
        expectException("выфавы@asdasd.com");
        expectException("ñañlkjdf@hotmail.com");
        expectException("test+§@test.com");
        expectException("可扩展@资本.com");
    }

    @Test
    public void shouldNotAllowDotsInWeirdPlaces() {
        expectException(".user@host.com");
        expectException("user.@host.com");
        expectException(".user.@host.com");
        expectException("user..name@host.com");
    }

    private void expectException(String address) {
        try {
            EmailAddress.of(address);
            fail(String.format("Address %s should have thrown InvalidEmailAddressException", address));
        } catch (IllegalArgumentException ex) {
            // OK
        }
    }
}
