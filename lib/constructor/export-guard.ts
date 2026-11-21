import {
  keychainQrCardSpec,
  type ConstructorParams,
} from "@/lib/constructor/params";
import {
  KEYCHAIN_NFC_TAG_MM,
  measureKeychainNfc,
} from "@/lib/constructor/keychain-geometry";
import {
  isKeychainPresetImplemented,
  nfcLayout,
} from "@/lib/constructor/keychain-preset-geometry";
import { keychainPresetById } from "@/lib/constructor/keychain-presets";
import { qrCardPlan } from "@/lib/constructor/qr-card-geometry";

/**
 * Причина, по которой скачивание STL сейчас невозможно.
 *
 * Одни и те же проверки нужны панели настроек и нижней панели на телефоне.
 * Раньше причина считалась только в `ParameterPanel`, поэтому кнопку внизу
 * экрана нельзя было заблокировать заранее. Функция чистая: параметры те же,
 * ответ тот же, что у геометрии и серверного экспорта.
 */
export function constructorExportBlockReason(
  params: ConstructorParams,
): string | null {
  if (params.model !== "keychain") {
    return null;
  }

  const preset = params.keychainPreset
    ? keychainPresetById(params.keychainPreset)
    : null;

  if (preset && !isKeychainPresetImplemented(preset.id)) {
    return "Этот пресет ещё в разработке. Выберите другой пресет.";
  }

  if (params.keychainPreset === "qr-card") {
    const plan = qrCardPlan(keychainQrCardSpec(params));
    const qrReason = plan.contentError ?? plan.layout.blockedReason;

    if (qrReason) {
      return qrReason;
    }
  }

  if (!params.nfcEnabled) {
    return null;
  }

  if (!params.keychainPreset) {
    const fit = measureKeychainNfc(params);

    if (!fit) {
      return null;
    }

    if (fit.cavityMm <= 0) {
      return "Этот силуэт не поддерживает NFC-метку: карман под квадрат 25 × 25 мм не вырезается. Выберите силуэт шире или выключите карман.";
    }

    return fit.fits
      ? null
      : `Карман под метку не помещается: в этом силуэте максимум ${fit.cavityMm.toFixed(1)} × ${fit.cavityMm.toFixed(1)} мм при метке ${KEYCHAIN_NFC_TAG_MM} × ${KEYCHAIN_NFC_TAG_MM} мм. Выберите силуэт шире или выключите карман.`;
  }

  const layout = nfcLayout(params.keychainPreset, {
    width: params.width,
    height: params.length,
    thickness: params.thickness,
    nfcEnabled: params.nfcEnabled,
    holePlacement: params.holePlacement,
    qr:
      params.keychainPreset === "qr-card"
        ? keychainQrCardSpec(params)
        : null,
  });

  return layout.blockedReason ?? null;
}
