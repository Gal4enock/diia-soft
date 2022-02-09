//=============================================================================

/* Підключення бібліотек JavaScript */
var fs = require("fs");
var path = require("path");

// function readFile(path, code) {
//   const _readFile = util.promisify(fs.readFile);
//   if (path) {
//     return await _readFile(path, code);
//   }
// }

// let encodedDataInfo = "";
async function getEncodeInfo(cb) {
  eval(
    fs.readFileSync(path.resolve(__dirname, "lib", "euscpt.js"), {
      encoding: "utf-8",
    })
  );
  eval(
    fs.readFileSync(path.resolve(__dirname, "lib", "euscpm.js"), {
      encoding: "utf-8",
    })
  );
  eval(
    fs.readFileSync(path.resolve(__dirname, "lib", "euscp.js"), {
      encoding: "utf-8",
    })
  );

  //=============================================================================

  /* Налаштування серверів ЦСК */
  var g_CAs = path.resolve(__dirname, "certificates", "CAs.Test.json");

  /* Масив з шляхом до кореневих сертификатів ЦЗО та ЦСК */
  var g_CACerts = [
    path.resolve(__dirname, "certificates", "CACertificates.Test.p7b"),
  ];

  /* Налаштування ЦСК за замовчанням */
  var g_CADefaultSettings = {
    issuerCNs: [
      "Акредитований центр сертифікації ключів ІДД ДФС",
      "Акредитований центр сертифікації ключів ІДД Міндоходів",
      "Акредитований центр сертифікації ключів ІДД ДПС",
    ],
    address: "acskidd.gov.ua",
    ocspAccessPointAddress: "acskidd.gov.ua/services/ocsp/",
    ocspAccessPointPort: "80",
    cmpAddress: "acskidd.gov.ua",
    tspAddress: "acskidd.gov.ua",
    tspAddressPort: "80",
    directAccess: true,
  };

  var g_protectedFiles = [
    path.resolve(__dirname, "data", "encodedData.json.p7s.p7e"),
    path.resolve(
      __dirname,
      "data",
      "internal-passport-2858364170864-02.04.2021-09_48_26.pdf.p7s.p7e"
    ),
  ];

  //-----------------------------------------------------------------------------

  /* Налаштування ос. ключа */
  var g_PKey = {
    filePath: path.resolve(
      __dirname,
      "certificates",
      "Key-6.dat"
    ) /* Шлях до файлу з ос. ключем */,
    password: "12345677" /* Пароль до файлу з ос. ключем */,
    certificates: [
      /* Масив з шляхами до файлів сертифікатів ос. ключа */
      path.resolve(
        __dirname,
        "certificates",
        "EU-5B63D88375D9201804000000A02202009D740400.cer"
      ),
      path.resolve(
        __dirname,
        "certificates",
        "EU-KEP-5B63D88375D9201804000000A02202009E740400.cer"
      ),
    ],
    CACommonName:
      'Тестовий ЦСК АТ "ІІТ"' /*Ім'я ЦСК, що видав сертифікат ос. ключа*/,
  };

  //-----------------------------------------------------------------------------

  var g_euSign = null;
  var g_isLibraryLoaded = false;
  var g_context = null;
  var g_pkContext = null;

  //=============================================================================

  /* Ініціалізація налаштувань криптографічної бібліотеки */
  function SetSettings(CAs, CASettings) {
    var offline = true;
    var useOCSP = false;
    var useCMP = false;

    offline = CASettings == null || CASettings.address == "" ? true : false;
    useOCSP = !offline && CASettings.ocspAccessPointAddress != "";
    useCMP = !offline && CASettings.cmpAddress != "";

    g_euSign.SetJavaStringCompliant(true);

    var settings = g_euSign.CreateFileStoreSettings();
    settings.SetPath("");
    settings.SetSaveLoadedCerts(false);
    g_euSign.SetFileStoreSettings(settings);

    settings = g_euSign.CreateModeSettings();
    settings.SetOfflineMode(offline);
    g_euSign.SetModeSettings(settings);

    settings = g_euSign.CreateProxySettings();
    g_euSign.SetProxySettings(settings);

    settings = g_euSign.CreateTSPSettings();
    settings.SetGetStamps(!offline);
    if (!offline) {
      if (CASettings.tspAddress != "") {
        settings.SetAddress(CASettings.tspAddress);
        settings.SetPort(CASettings.tspAddressPort);
      } else if (g_CADefaultSettings) {
        settings.SetAddress(g_CADefaultSettings.tspAddress);
        settings.SetPort(g_CADefaultSettings.tspAddressPort);
      }
    }
    g_euSign.SetTSPSettings(settings);

    settings = g_euSign.CreateOCSPSettings();
    if (useOCSP) {
      settings.SetUseOCSP(true);
      settings.SetBeforeStore(true);
      settings.SetAddress(CASettings.ocspAccessPointAddress);
      settings.SetPort("80");
    }
    g_euSign.SetOCSPSettings(settings);

    settings = g_euSign.CreateOCSPAccessInfoModeSettings();
    settings.SetEnabled(true);
    g_euSign.SetOCSPAccessInfoModeSettings(settings);
    settings = g_euSign.CreateOCSPAccessInfoSettings();
    for (var i = 0; i < CAs.length; i++) {
      settings.SetAddress(CAs[i].ocspAccessPointAddress);
      settings.SetPort(CAs[i].ocspAccessPointPort);

      for (var j = 0; j < CAs[i].issuerCNs.length; j++) {
        settings.SetIssuerCN(CAs[i].issuerCNs[j]);
        g_euSign.SetOCSPAccessInfoSettings(settings);
      }
    }

    settings = g_euSign.CreateCMPSettings();
    settings.SetUseCMP(useCMP);
    if (useCMP) {
      settings.SetAddress(CASettings.cmpAddress);
      settings.SetPort("80");
    }
    g_euSign.SetCMPSettings(settings);

    settings = g_euSign.CreateLDAPSettings();
    g_euSign.SetLDAPSettings(settings);
  }

  //-----------------------------------------------------------------------------

  /* Імпорт сертифікатів до сховища криптографічної бібліотеки */
  function LoadCertificates(certsFilePathes) {
    if (!certsFilePathes) return;

    for (var i = 0; i < certsFilePathes.length; i++) {
      var path = certsFilePathes[i];
      const fileCert = fs.readFileSync(path);
      var data = new Uint8Array(fileCert);
      if (path.substr(path.length - 3) == "p7b") {
        g_euSign.SaveCertificates(data);
      } else {
        g_euSign.SaveCertificate(data);
      }
    }
  }

  //-----------------------------------------------------------------------------

  /* Зчитування особистого ключа */
  /* Ос. ключ використовується в функціях накладання підпису, зашифрування та */
  /* розшифрування даних */
  function ReadPrivateKey(pKeyFilePath, password, certsFilePathes) {
    /* Імпорт сертифікатів ос. ключа */
    LoadCertificates(certsFilePathes);
    /* Зчитування ключа */
    var pKeyData = new Uint8Array(fs.readFileSync(pKeyFilePath));
    g_pkContext = g_euSign.CtxReadPrivateKeyBinary(
      g_context,
      pKeyData,
      password
    );
  }

  //-----------------------------------------------------------------------------

  /* Ініціалізація криптографічної бібліотеки та встановлення налаштувань */
  function Initialize(readPrivKey) {
    /* Перевірка необхідності ініціалізації криптографічної бібліотеки */
    if (!g_euSign.IsInitialized()) {
      /* Ініціалізація криптографічної бібліотеки */
      g_euSign.Initialize();
    }

    /* Перевірка необхідності встановлення налаштувань крипт. бібліотеки */
    if (g_euSign.DoesNeedSetSettings()) {
      /* Зчитування файлу з налаштуваннями ЦСК */
      var CAs = JSON.parse(fs.readFileSync(g_CAs), "utf8");

      /* Отримання налаштувань ЦСК для ос. ключа */
      var CASettings = null;
      for (var i = 0; i < CAs.length; i++) {
        for (var j = 0; j < CAs[i].issuerCNs.length; j++) {
          if (g_PKey.CACommonName == CAs[i].issuerCNs[j]) {
            CASettings = CAs[i];
            break;
          }
        }

        if (CASettings) break;
      }

      /* Встановлення параметрів за замовчанням */
      SetSettings(CAs, CASettings);

      /* Завантаження сертифікатів ЦСК */
      LoadCertificates(g_CACerts);
    }

    if (g_context == null) g_context = g_euSign.CtxCreate();

    if (readPrivKey) {
      /* Перевірка чи зчитано ос. ключ */
      if (g_pkContext == null) {
        /* Зчитування ос. ключа */
        ReadPrivateKey(g_PKey.filePath, g_PKey.password, g_PKey.certificates);
      }
    }
  }

  //-----------------------------------------------------------------------------

  /* Отримання ключа розподілу для зашифрування відповіді */
  function getKeyAgreementCert(onSuccess, onError) {
    if (!g_isLibraryLoaded) {
      setTimeout(function () {
        getKeyAgreementCert(onSuccess, onError);
      }, 100);
      return;
    }

    try {
      Initialize(true);

      var cert = g_euSign.CtxGetOwnCertificate(
        g_pkContext,
        EU_CERT_KEY_TYPE_DSTU4145,
        EU_KEY_USAGE_KEY_AGREEMENT
      );
      onSuccess(g_euSign.Base64Encode(cert.GetData()));
    } catch (e) {
      onError(e);
    }
  }

  //-----------------------------------------------------------------------------

  /* Розшифрування та перевірка файлів */
  function unprotectFiles(files, onSuccess, onError) {
    if (!g_isLibraryLoaded) {
      setTimeout(function () {
        unprotectFiles(files, onSuccess, onError);
      }, 100);
      return;
    }

    try {
      Initialize(true);

      var results = [];
      for (var i = 0; i < files.length; i++) {
        var inFile = files[i];
        var outFile = inFile.substring(0, inFile.lastIndexOf(".p7s.p7e"));
        var inFileData = fs.readFileSync(inFile, "utf8");

        var senderInfo = g_euSign.CtxDevelopData(g_pkContext, inFileData, null);

        var signerInfo = g_euSign.VerifyDataInternal(senderInfo.GetData());

        fs.writeFileSync(outFile, signerInfo.GetData());
        results.push(outFile);
      }

      onSuccess(results);
    } catch (e) {
      onError(e);
    }
  }

  //=============================================================================

  /* Функція викликається після завантаження бібліотеки */
  /* Функції бібліотеки можна викликати тільки після виклику EUSignCPModuleInitialized */
  function EUSignCPModuleInitialized(isInitialized) {
    console.log("EUSignCP module loaded - " + isInitialized);

    g_isLibraryLoaded = isInitialized;

    getKeyAgreementCert(
      function (cert) {
        // console.log("Key agreement cert:");
        // console.log(cert);

        unprotectFiles(
          g_protectedFiles,
          function (result) {
            console.log("Unprotected files:");
            // console.log(result);
            cb(null, result);
          },
          function (e) {
            console.log("Error at unprotect files: " + e);
          }
        );
      },
      function (e) {
        console.log("Error at getKeyAgreementCert: " + e);
      }
    );
    // console.log("encodedDataInfo", encodedDataInfo);
    // return encodedDataInfo;
  }

  //=============================================================================
  // console.log("result", results.length);
  var g_euSign = EUSignCP();
  // return new Promise((res, rej) => {
  //   if (results.length) {
  //     res(true);
  //   }
  // });
}
//=============================================================================
// getEncodeInfo();
module.exports = getEncodeInfo;
