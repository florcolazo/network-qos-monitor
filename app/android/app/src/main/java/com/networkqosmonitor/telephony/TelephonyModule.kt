package com.networkqosmonitor.telephony

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellInfoWcdma
import android.telephony.CellSignalStrengthNr
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

/**
 * Expone a JavaScript información de la red celular obtenida desde TelephonyManager:
 * operador, tipo de red (LTE, NR, HSPA...), generación (2G/3G/4G/5G) e intensidad de señal.
 */
class TelephonyModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  @ReactMethod
  fun getCellInfo(promise: Promise) {
    try {
      val tm = reactApplicationContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
      val result = Arguments.createMap()

      result.putBoolean("simReady", tm.simState == TelephonyManager.SIM_STATE_READY)
      result.putString("operatorName", tm.networkOperatorName.takeIf { it.isNotBlank() })
      val mccMnc = tm.networkOperator
      if (mccMnc.length >= 5) {
        result.putString("mcc", mccMnc.substring(0, 3))
        result.putString("mnc", mccMnc.substring(3))
      }
      result.putBoolean("isRoaming", tm.isNetworkRoaming)

      // Desde Android 11 getDataNetworkType requiere READ_PHONE_STATE.
      val networkType =
        if (hasPermission(Manifest.permission.READ_PHONE_STATE)) tm.dataNetworkType
        else TelephonyManager.NETWORK_TYPE_UNKNOWN
      result.putString("networkType", networkTypeName(networkType))
      result.putString("generation", generation(networkType))

      putSignalStrength(tm, result)
      putServingCell(tm, result)

      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("E_TELEPHONY", e.message, e)
    }
  }

  private fun putSignalStrength(tm: TelephonyManager, out: WritableMap) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return
    val ss = tm.signalStrength ?: return
    out.putInt("signalLevel", ss.level) // 0 (sin señal) .. 4 (excelente)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ss.cellSignalStrengths.firstOrNull()?.let {
        out.putValid("signalDbm", it.dbm)
        out.putValid("asuLevel", it.asuLevel)
      }
    }
  }

  /** Datos de la celda a la que está registrado el equipo (requiere ubicación precisa). */
  private fun putServingCell(tm: TelephonyManager, out: WritableMap) {
    if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) return
    val cell: CellInfo = tm.allCellInfo?.firstOrNull { it.isRegistered } ?: return
    when {
      cell is CellInfoLte -> {
        out.putString("cellTech", "LTE")
        out.putValid("rsrp", cell.cellSignalStrength.rsrp)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          out.putValid("rsrq", cell.cellSignalStrength.rsrq)
        }
        out.putValid("cellId", cell.cellIdentity.ci)
        out.putValid("pci", cell.cellIdentity.pci)
        if (!out.hasKey("signalDbm")) out.putValid("signalDbm", cell.cellSignalStrength.dbm)
      }
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && cell is CellInfoNr -> {
        out.putString("cellTech", "NR")
        val nr = cell.cellSignalStrength as CellSignalStrengthNr
        out.putValid("rsrp", nr.ssRsrp)
        out.putValid("rsrq", nr.ssRsrq)
        if (!out.hasKey("signalDbm")) out.putValid("signalDbm", nr.dbm)
      }
      cell is CellInfoWcdma -> {
        out.putString("cellTech", "WCDMA")
        out.putValid("cellId", cell.cellIdentity.cid)
        if (!out.hasKey("signalDbm")) out.putValid("signalDbm", cell.cellSignalStrength.dbm)
      }
      cell is CellInfoGsm -> {
        out.putString("cellTech", "GSM")
        out.putValid("cellId", cell.cellIdentity.cid)
        if (!out.hasKey("signalDbm")) out.putValid("signalDbm", cell.cellSignalStrength.dbm)
      }
    }
  }

  /** Android usa Int.MAX_VALUE (CellInfo.UNAVAILABLE) cuando un valor no está disponible. */
  private fun WritableMap.putValid(key: String, value: Int) {
    if (value != Int.MAX_VALUE && value != Int.MIN_VALUE) putInt(key, value)
  }

  private fun hasPermission(permission: String) =
    ContextCompat.checkSelfPermission(reactApplicationContext, permission) ==
      PackageManager.PERMISSION_GRANTED

  companion object {
    const val NAME = "TelephonyModule"

    // Se usan los valores numéricos de TelephonyManager.NETWORK_TYPE_* para no
    // depender del nivel de API en que se agregó cada constante.
    fun networkTypeName(type: Int): String = when (type) {
      1 -> "GPRS"
      2 -> "EDGE"
      3 -> "UMTS"
      4 -> "CDMA"
      5 -> "EVDO_0"
      6 -> "EVDO_A"
      7 -> "1xRTT"
      8 -> "HSDPA"
      9 -> "HSUPA"
      10 -> "HSPA"
      11 -> "IDEN"
      12 -> "EVDO_B"
      13 -> "LTE"
      14 -> "EHRPD"
      15 -> "HSPAP"
      16 -> "GSM"
      17 -> "TD_SCDMA"
      18 -> "IWLAN"
      19 -> "LTE_CA"
      20 -> "NR"
      else -> "UNKNOWN"
    }

    fun generation(type: Int): String? = when (type) {
      1, 2, 4, 7, 11, 16 -> "2G"
      3, 5, 6, 8, 9, 10, 12, 14, 15, 17 -> "3G"
      13, 19 -> "4G"
      20 -> "5G"
      else -> null
    }
  }
}
