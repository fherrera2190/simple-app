import * as Device from "expo-device";
import * as FileSystem from "expo-file-system";
import * as Network from "expo-network";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Pdf from "react-native-pdf";
import { WebView } from "react-native-webview";

type DiagnosticLogType = "info" | "success" | "warning" | "error";

interface DiagnosticLog {
  id: number;
  timestamp: string;
  message: string;
  type: DiagnosticLogType;
}

const DEFAULT_TIMEOUT_MS = 10000;

export default function App() {
  const [url, setUrl] = useState("");
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfLocalUri, setPdfLocalUri] = useState("");
  const [deviceInfo, setDeviceInfo] = useState({
    localIP: "Detectando...",
    gatewayOrMask: "Detectando...",
    connectionType: "Detectando...",
    osVersion: "Detectando...",
    apiLevel: "Detectando...",
  });

  const logIdRef = useRef(1);

  const HCP_HEADERS = [
    { key: "content-type", label: "Content-Type" },
    { key: "x-hcp-contentlength", label: "X-HCP-ContentLength" },
    { key: "x-hcp-retention", label: "X-HCP-Retention" },
    { key: "x-hcp-retentionhold", label: "X-HCP-RetentionHold" },
    {
      key: "x-hcp-labelretentionhold",
      label: "X-HCP-LabelRetentionHold",
    },
    { key: "content-encoding", label: "Content-Encoding" },
    { key: "transfer-encoding", label: "Transfer-Encoding" },
    { key: "cache-control", label: "Cache-Control" },
  ];

  const logResponseHeaders = (response: Response) => {
    addLog("=== Cabeceras HTTP ===", "info");

    HCP_HEADERS.forEach(({ key, label }) => {
      addLog(
        `${label}: ${response.headers.get(key) ?? "<no presente>"}`,
        "info",
      );
    });

    addLog("======================", "info");
  };

  useEffect(() => {
    void loadDeviceInfo();
  }, []);

  const addLog = (message: string, type: DiagnosticLogType = "info") => {
    const newLog: DiagnosticLog = {
      id: logIdRef.current++,
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // AGREGADO: Función para borrar y resetear todo el panel de diagnóstico
  const clearDiagnostic = () => {
    setUrl("");
    setLogs([]);
    setIsPdf(false);
    setPdfUrl("");
    setPdfLocalUri("");
    logIdRef.current = 1;
  };

  const normalizeTargetUrl = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new Error("La URL no puede estar vacía.");
    }
    const hasScheme = /^https?:\/\//i.test(trimmed);
    return hasScheme ? trimmed : `https://${trimmed}`;
  };

  const fetchWithTimeout = async (
    input: string,
    init: RequestInit,
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const validateContentType = async (
    rawTargetUrl: string,
  ): Promise<boolean> => {
    addLog(`Validando recurso por extensión...`, "info");
    const isPdf = rawTargetUrl.toLowerCase().includes(".pdf");
    addLog(`¿Tiene extensión PDF?: ${isPdf ? "Sí" : "No"}`, "info");
    return isPdf;
  };

  // Asegururate de que tu import incluya Network si no estaba expuesto,
  // o usalo directamente desde el objeto FileSystem principal:
  const downloadPdfFile = async (sourceUrl: string) => {
    const trimmedUrl = sourceUrl.trim();
    const hasScheme = /^https?:\/\//i.test(trimmedUrl);
    const finalUrl = hasScheme ? trimmedUrl : `https://${trimmedUrl}`;

    const fileName = `documento_${Date.now()}.pdf`;

    addLog("Descargando PDF al almacenamiento local...", "info");

    try {
      const cacheDir = FileSystem.Paths.cache;
      const destinationFile = new FileSystem.File(cacheDir, fileName);

      const downloadedFile = await FileSystem.File.downloadFileAsync(
        finalUrl,
        destinationFile,
        {
          idempotent: true,
        },
      );

      addLog(`Archivo guardado en caché del dispositivo`, "success");

      return downloadedFile.uri;
    } catch (error) {
      addLog(`Error: ${String(error)}`, "error");
      throw error;
    }
  };
  const handleInlineViewPdf = async () => {
    if (!url) return;
    setIsProcessingPdf(true);
    addLog("=== Iniciando Proceso de Visualización ===", "info");

    try {
      const localPath = await downloadPdfFile(url);

      // Configuramos la URI final según la plataforma
      if (Platform.OS === "ios") {
        // iOS puede leer archivos locales "file://" directamente en el WebView
        setPdfLocalUri(localPath);
      } else {
        // Android NO lee PDFs locales directamente en WebView por restricciones de seguridad.
        // Para Android, le pasamos la URL remota optimizada con el visor de Google.
        const remoteUrl = normalizeTargetUrl(url);
        setPdfLocalUri(
          `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(remoteUrl)}`,
        );
      }

      setShowPdfModal(true);
      addLog("Montando WebView interno para el renderizado", "success");
    } catch (error) {
      addLog(`Error al procesar el visor: ${String(error)}`, "error");
      Alert.alert("Error", "No se pudo abrir el visor interno.");
    } finally {
      setIsProcessingPdf(false);
    }
  };

  const simulateTraceroute = async (rawTargetUrl: string) => {
    addLog("=== Iniciando diagnóstico de conectividad ===", "info");

    try {
      const targetUrl = normalizeTargetUrl(rawTargetUrl);
      const url = new URL(targetUrl);

      addLog(`URL: ${targetUrl}`, "info");
      addLog(`Host: ${url.hostname}`, "info");
      addLog(
        `Protocolo: ${url.protocol.replace(":", "").toUpperCase()}`,
        "info",
      );

      // Información de red del dispositivo
      const networkState = await Network.getNetworkStateAsync();

      addLog(
        `Conectado: ${networkState.isConnected ? "Sí" : "No"}`,
        networkState.isConnected ? "success" : "error",
      );

      addLog(
        `Internet alcanzable: ${
          networkState.isInternetReachable ? "Sí" : "No"
        }`,
        networkState.isInternetReachable ? "success" : "error",
      );

      if (networkState.type) {
        addLog(`Tipo de red: ${networkState.type}`, "info");
      }

      if (deviceInfo.localIP) {
        addLog(`IP local: ${deviceInfo.localIP}`, "info");
      }

      addLog("Estableciendo conexión HTTP...", "info");

      const startTime = Date.now();

      const response = await fetch(targetUrl, {
        method: "GET",
      });

      const elapsed = Date.now() - startTime;

      addLog(
        `Conexión establecida en ${elapsed} ms`,
        response.ok ? "success" : "error",
      );

      addLog(
        `Respuesta HTTP: ${response.status} ${response.statusText}`,
        response.ok ? "success" : "error",
      );

      addLog(`Redirección: ${response.redirected ? "Sí" : "No"}`, "info");

      if (response.redirected) {
        addLog(`URL final: ${response.url}`, "info");
      }

      const headers = [
        ["content-type", "Content-Type"],
        ["content-length", "Content-Length"],
        ["x-hcp-contentlength", "X-HCP-ContentLength"],
        ["x-hcp-retention", "X-HCP-Retention"],
        ["x-hcp-retentionhold", "X-HCP-RetentionHold"],
        ["x-hcp-labelretentionhold", "X-HCP-LabelRetentionHold"],
        ["content-encoding", "Content-Encoding"],
        ["transfer-encoding", "Transfer-Encoding"],
        ["cache-control", "Cache-Control"],
        ["server", "Server"],
        ["etag", "ETag"],
        ["last-modified", "Last-Modified"],
      ];

      addLog("=== Cabeceras HTTP ===", "info");

      headers.forEach(([key, label]) => {
        const value = response.headers.get(key);

        if (value !== null) {
          addLog(`${label}: ${value}`, "info");
        }
      });

      addLog(`Tiempo total: ${elapsed} ms`, "info");

      addLog("=== Diagnóstico completado ===", "success");
    } catch (error) {
      addLog(
        `Error durante el diagnóstico: ${
          error instanceof Error ? error.message : String(error)
        }`,
        "error",
      );

      addLog("=== Diagnóstico finalizado con errores ===", "error");
    }
  };

  const loadDeviceInfo = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const ipAddress = await Network.getIpAddressAsync();
      setDeviceInfo({
        localIP: ipAddress || "No disponible",
        gatewayOrMask: networkState.type || "No disponible",
        connectionType: networkState.type || "Desconocido",
        osVersion: Device.osVersion ?? "Desconocido",
        apiLevel: Platform.OS === "android" ? String(Platform.Version) : "N/A",
      });
    } catch {
      addLog("Error al recolectar info de red local", "warning");
    }
  };

  const startDiagnostic = async () => {
    if (!url.trim()) {
      Alert.alert("Error", "Por favor ingrese una URL válida.");
      return;
    }

    setIsRunning(true);
    setLogs([]);
    setIsPdf(false);
    setPdfUrl("");
    setPdfLocalUri("");

    try {
      addLog("Evaluando destino de red...", "info");

      // Al pasarle la URL con .pdf, esto va a dar true directo sin romper el flujo por CORS
      const pdfDetected = await validateContentType(url);

      if (pdfDetected) {
        setPdfUrl(url);
        setIsPdf(true); // Esto te va a habilitar el botón "Ver documento" al instante
        addLog("✓ Recurso listo para descarga directa", "success");
      } else {
        addLog(
          "⚠ La URL no parece contener un .pdf, pero puedes intentar forzar la traza",
          "warning",
        );
      }

      // Ejecutamos la traza de red modificada para que no use HEAD
      await simulateTraceroute(url);
    } catch (error) {
      addLog(`Excepción de red general: ${String(error)}`, "error");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.deviceCard}>
          <Text style={styles.title}>Estado del Nodo Local</Text>
          <View style={styles.row}>
            <Text style={styles.label}>IP Local</Text>
            <Text style={styles.value}>{deviceInfo.localIP}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Interfaz</Text>
            <Text style={styles.value}>{deviceInfo.connectionType}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Plataforma</Text>
            <Text style={styles.value}>
              {Platform.OS.toUpperCase()} (API {deviceInfo.apiLevel})
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="Pegar endpoint de AWS S3 o IP corporativa"
            placeholderTextColor="#999"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            editable={!isRunning}
          />

          {/* Contenedor de Botones Principales en Fila */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.flexButton,
                isRunning && styles.buttonDisabled,
              ]}
              onPress={startDiagnostic}
              disabled={isRunning}
            >
              {isRunning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Ejecutar Traza</Text>
              )}
            </TouchableOpacity>

            {/* AGREGADO: Botón de borrar interactivo */}
            <TouchableOpacity
              style={[styles.clearButton, isRunning && styles.buttonDisabled]}
              onPress={clearDiagnostic}
              disabled={isRunning}
            >
              <Text style={styles.clearButtonText}>Borrar</Text>
            </TouchableOpacity>
          </View>

          {isPdf && !isRunning && (
            <View style={styles.pdfActionsContainer}>
              <TouchableOpacity
                style={[styles.pdfButton, { backgroundColor: "#0284c7" }]}
                onPress={handleInlineViewPdf}
                disabled={isProcessingPdf}
              >
                {isProcessingPdf ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.pdfButtonText}>
                    👁 Ver documento (Pantalla Completa)
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.logsCard}>
          <Text style={styles.title}>Logs del Segmento de Red</Text>
          <ScrollView
            style={styles.logsScroll}
            contentContainerStyle={styles.logsContent}
          >
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>
                Esperando inicialización de traza...
              </Text>
            ) : (
              logs.map((log) => (
                <View
                  key={log.id}
                  style={[styles.logItem, styles[`log_${log.type}`]]}
                >
                  <Text style={styles.logTimestamp}>[{log.timestamp}]</Text>
                  <Text style={styles.logMessage}>{log.message}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={showPdfModal}
        animationType="slide"
        onRequestClose={() => setShowPdfModal(false)}
      >
        {pdfLocalUri ? (
          <WebView
            originWhitelist={["*"]}
            source={{ uri: pdfLocalUri }}
            style={styles.pdfViewer} // Mantiene tu estilo actual flex: 1
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            onLoadEnd={() => {
              addLog("WebView: Contenedor cargado exitosamente.", "success");
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              addLog(`Error en WebView: ${nativeEvent.description}`, "error");
            }}
          />
        ) : (
          <View style={styles.modalEmpty}>
            <Text style={styles.emptyText}>Ruta de archivo no disponible.</Text>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, padding: 14 },
  deviceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  logsCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 14,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#1e293b",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  value: { fontSize: 13, color: "#0f172a", fontWeight: "700" },
  input: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginBottom: 10,
  },

  // Modificaciones para alinear botones sin romper nada
  actionRow: { flexDirection: "row", gap: 10 },
  flexButton: { flex: 2 },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#94a3b8", opacity: 0.6 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },

  // Estilo del nuevo botón de borrar
  clearButton: {
    flex: 1,
    backgroundColor: "#64748b",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },

  pdfActionsContainer: { marginTop: 10 },
  pdfButton: { borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  pdfButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  logsScroll: { flex: 1, marginTop: 8 },
  logsContent: { paddingBottom: 10 },
  emptyText: {
    color: "#475569",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 20,
  },
  logItem: {
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    gap: 8,
  },
  log_info: { backgroundColor: "#1e293b" },
  log_success: { backgroundColor: "#064e3b" },
  log_warning: { backgroundColor: "#78350f" },
  log_error: { backgroundColor: "#7f1d1d" },
  logTimestamp: { fontSize: 12, color: "#94a3b8", fontFamily: "monospace" },
  logMessage: { fontSize: 13, color: "#f8fafc", flex: 1 },
  modalWrapper: { flex: 1, backgroundColor: "#ffffff" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: { fontSize: 16, color: "#111827", fontWeight: "700" },
  pdfViewer: { flex: 1, width: "100%", backgroundColor: "#525659" },
  modalEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
});
