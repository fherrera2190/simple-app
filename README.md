# Simple App

Esta aplicación móvil fue desarrollada con Expo y React Native para realizar diagnósticos básicos de conectividad, revisar respuestas HTTP y visualizar archivos PDF desde una URL.

El objetivo del proyecto es ofrecer una herramienta sencilla para probar recursos remotos, inspeccionar cabeceras y entender mejor cómo se comporta una página o documento desde un dispositivo móvil.

## ¿Qué hace esta app?

Simple App permite:

- ingresar una URL para analizar su comportamiento;
- revisar información básica de red del dispositivo;
- inspeccionar cabeceras HTTP importantes;
- abrir archivos PDF directamente desde una dirección web;
- ver el resultado de forma clara mediante un panel de logs.

## Tecnologías utilizadas

- Expo
- React Native
- TypeScript
- Expo Router
- react-native-webview
- react-native-pdf
- expo-network y expo-file-system

## Cómo ejecutar el proyecto

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Inicia la aplicación:

   ```bash
   npx expo start
   ```

3. Abre la app en tu emulador, dispositivo físico o Expo Go.

## Funcionalidades principales

- Diagnóstico de conexión y red
- Validación de recursos remotos
- Visualización de respuestas HTTP
- Apertura de PDFs en modo integrado
- Registro de eventos y errores en tiempo real

## Estructura del proyecto

- App.tsx: lógica principal de la aplicación
- src/: componentes y navegación
- assets/: recursos visuales e íconos
- scripts/: utilidades del proyecto

## Contribuciones

Si quieres mejorar este proyecto, puedes abrir un issue o enviar un pull request.

## Licencia

Este proyecto se distribuye bajo la licencia MIT.
