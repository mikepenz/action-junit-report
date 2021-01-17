package action.surefire.report.calc

import org.hamcrest.MatcherAssert.assertThat
import org.hamcrest.Matchers.equalTo
import org.junit.Assert.assertThrows
import org.junit.Test
import java.math.BigDecimal

class CalcUtilsTest {

    @Test
    fun `test scale`() {
        assertThat(scale("100.0000"), equalTo(BigDecimal("100.00")))
        assertThat(scale("100.0100"), equalTo(BigDecimal("100.01")))
        assertThat(scale("100.110"), equalTo(BigDecimal("100.10")))
        assertThat(scale("100.1"), equalTo(BigDecimal("100.10")))
        assertThat(scale("100"), equalTo(BigDecimal("100.00")))
        assertThat(scale(".0000"), equalTo(BigDecimal("0.00")))
        assertThat(scale(".0100"), equalTo(BigDecimal("0.01")))
        assertThat(scale(".110"), equalTo(BigDecimal("0.11")))
        assertThat(scale(".1"), equalTo(BigDecimal("0.10")))
        assertThat(scale("0"), equalTo(BigDecimal("0.00")))
    }

    @Test
    fun `test error handling`() {
        assertThrows(IllegalStateException::class.java) { scale("100.001") }
    }

    private fun scale(amount: String): BigDecimal {
        return CalcUtils.scaleAmount(BigDecimal(amount))
    }
}