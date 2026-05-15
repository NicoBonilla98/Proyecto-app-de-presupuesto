# APK Android

Esta app web puede empaquetarse como APK usando Capacitor. La app Android mantiene datos locales en el celular cuando no hay conexion y sincroniza con la Raspberry cuando vuelve a estar en la intranet.

## Requisitos en la PC que compile

- Node.js con npm
- Android Studio
- Android SDK instalado desde Android Studio
- JDK configurado por Android Studio

## Primer setup

```bash
npm install
npm run mobile:add:android
```

## Generar o actualizar Android despues de cambios web

```bash
npm run mobile:sync
```

## Abrir Android Studio

```bash
npm run mobile:open
```

Desde Android Studio se puede ejecutar en un telefono conectado o generar el APK en:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

## Generar APK firmado

El APK firmado necesita una llave privada local. No subas esta llave a Git y no la pierdas: si luego quieres actualizar la misma app instalada, Android exige firmar las nuevas versiones con la misma llave.

Crear una carpeta local para llaves:

```bash
mkdir android\keystores
```

Crear la llave:

```bash
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore android\keystores\presupuesto-hogar-release.jks -alias presupuesto-hogar -keyalg RSA -keysize 2048 -validity 10000
```

Crear el archivo local `android/keystore.properties`:

```properties
storeFile=keystores/presupuesto-hogar-release.jks
storePassword=TU_PASSWORD
keyAlias=presupuesto-hogar
keyPassword=TU_PASSWORD
```

Ese archivo esta ignorado por Git.

Generar el APK firmado:

```bash
npm run mobile:release:apk
```

El archivo queda en:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## Servidor de sincronizacion

Dentro del APK, la app apunta por defecto a:

```text
http://192.168.100.54/api/state
```

Si cambia la IP de la Raspberry, se puede ajustar desde la consola del WebView o agregando una pantalla de configuracion despues. La clave local usada es:

```text
presupuesto-hogar:sync-server-url
```
