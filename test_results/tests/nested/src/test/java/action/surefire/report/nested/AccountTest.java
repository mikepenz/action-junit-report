package action.surefire.report.nested;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class AccountTest {

    @Test
    void opensWithZeroBalance() {
        assertEquals(0, new int[0].length);
    }

    @Nested
    class Deposit {

        @Test
        void addsTheAmount() {
            assertEquals(150, 100 + 49, "balance after deposit");
        }

        @Nested
        class Limit {

            @Test
            void rejectsLargeDeposits() {
                assertEquals(1000, 999, "deposit limit");
            }
        }
    }
}
