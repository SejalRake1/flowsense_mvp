package com.flowsense.app

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*
import java.security.MessageDigest

class UPINotificationListener : NotificationListenerService() {

    private val paymentApps = setOf(
        "com.phonepe.app",
        "com.google.android.apps.nbu.paisa.user",
        "net.one97.paytm",
        "in.org.npci.upiapp",
        "com.mobikwik_new",
        "com.freecharge.android",
        "com.sbi.lotusintouch",
        "com.htc.pps.indmobile",
        "com.csam.icici.bank.imobile",
        "com.axis.mobile",
        "com.kotak.mahindra.kotak",
        "com.hdfcbank.hdfcbankmobilebanking"
    )

    private val supabaseUrl = "https://cywntdkggaugujrvklaf.supabase.co/rest/v1/"
    private val supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5d250ZGtnZ2F1Z3VqcnZrbGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTUwMDMsImV4cCI6MjA5NTQzMTAwM30.IaK3j57JAKRrwg52A-Pzn8sdwb21IylTIoNzC2vEXdk"

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName
        if (packageName !in paymentApps) return

        val extras = sbn.notification.extras
        val title = extras.getString("android.title") ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val fullText = "$title $text"

        val transaction = parseTransaction(fullText, packageName) ?: return
        val hash = sha256(fullText)
        
        transaction.put("raw_hash", hash)
        transaction.put("parsed_at", isoNow())

        sendToSupabase(transaction)
    }

    private fun parseTransaction(text: String, source: String): JSONObject? {
        val amountRegex = Regex(
            """(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d{1,2})?)""",
            RegexOption.IGNORE_CASE
        )
        val amountMatch = amountRegex.find(text) ?: return null
        val amount = amountMatch.groupValues[1]
            .replace(",", "").toDoubleOrNull() ?: return null

        val isDebit = text.contains(
            Regex("""(?i)debited|paid|sent|deducted|payment of""")
        )
        val isCredit = text.contains(
            Regex("""(?i)credited|received|added|refund""")
        )
        if (!isDebit && !isCredit) return null

        val merchantRegex = Regex(
            """(?:to|at|for)\s+([A-Za-z0-9\s&'.\-]{2,30})""",
            RegexOption.IGNORE_CASE
        )
        val merchant = merchantRegex.find(text)
            ?.groupValues?.get(1)?.trim() ?: inferMerchant(source)

        val refRegex = Regex(
            """(?:UPI Ref|Ref No|txn id)[:\s]*([A-Z0-9]{10,20})""",
            RegexOption.IGNORE_CASE
        )
        val refId = refRegex.find(text)?.groupValues?.get(1) ?: ""

        return JSONObject().apply {
            put("amount", amount)
            put("type", if (isDebit) "debit" else "credit")
            put("merchant_raw", merchant)
            put("merchant_normalized", normalizeMerchant(merchant))
            put("upi_ref_id", refId)
            put("source", "notification")
            put("transacted_at", isoNow())
        }
    }

    private fun inferMerchant(pkg: String) = when (pkg) {
        "com.phonepe.app" -> "PhonePe"
        "com.google.android.apps.nbu.paisa.user" -> "Google Pay"
        "net.one97.paytm" -> "Paytm"
        else -> "Unknown"
    }

    private fun normalizeMerchant(raw: String): String {
        val map = mapOf(
            "swiggy" to "Swiggy",
            "zomato" to "Zomato",
            "uber" to "Uber",
            "ola" to "Ola",
            "amazon" to "Amazon",
            "flipkart" to "Flipkart",
            "netflix" to "Netflix",
            "spotify" to "Spotify",
            "hotstar" to "Hotstar",
            "blinkit" to "Blinkit",
            "zepto" to "Zepto",
            "phonepe" to "PhonePe",
            "paytm" to "Paytm"
        )
        val lower = raw.lowercase()
        return map.entries.firstOrNull { 
            lower.contains(it.key) 
        }?.value ?: raw.trim()
    }

    private fun sendToSupabase(data: JSONObject) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("$supabaseUrl/rest/v1/transactions")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("apikey", supabaseKey)
                conn.setRequestProperty("Authorization", "Bearer $supabaseKey")
                conn.setRequestProperty("Prefer", "return=minimal")
                conn.doOutput = true
                conn.outputStream.write(data.toString().toByteArray())
                Log.d("FlowSense", "Saved: ${conn.responseCode}")
            } catch (e: Exception) {
                Log.e("FlowSense", "Failed: ${e.message}")
            }
        }
    }

    private fun sha256(text: String): String {
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest(text.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun isoNow(): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date())
}
