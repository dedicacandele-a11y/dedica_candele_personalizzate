import { firebaseReady, isFirebaseLocal, storage } from "./firebase.js";

export async function uploadCatalogImage(file) {
  return uploadImage(file, "catalog_images");
}

export async function uploadPersonalizationImage(file) {
  return uploadImage(file, "temp_uploads/react");
}

export async function uploadOrderDraft(orderId, file) {
  if (!file) return "";
  if (!file.type?.startsWith("image/") && file.type !== "application/pdf") throw new Error("Carica un PDF oppure un’immagine JPG, PNG o WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Il file supera il limite di 10 MB.");
  await firebaseReady;
  if (isFirebaseLocal || !storage) return fileToDataUrl(file);
  const { getDownloadURL, ref, uploadBytes } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  const uploadId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").toLowerCase();
  const storageRef = ref(storage, `drafts/${orderId}/${uploadId}_${safeName}`);
  await uploadBytes(storageRef, file, { contentType: file.type, customMetadata: { orderId } });
  return getDownloadURL(storageRef);
}

export async function uploadOrderInvoice(orderId, file) {
  if (!file) return null;
  if (!file.type?.startsWith("image/") && file.type !== "application/pdf") throw new Error("Carica un PDF oppure un’immagine JPG, PNG o WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Il file supera il limite di 10 MB.");
  await firebaseReady;
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").toLowerCase();
  if (isFirebaseLocal || !storage) return { url: await fileToDataUrl(file), fileName: safeName, contentType: file.type };
  const { ref, uploadBytes } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  const storagePath = `invoices/${orderId}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type, customMetadata: { orderId, documentType: "invoice" } });
  return { storagePath, fileName: safeName, contentType: file.type };
}

export async function getOrderInvoiceBlob(invoice) {
  if (!invoice) throw new Error("Fattura non disponibile.");
  // Compatibilita con allegati creati prima della migrazione ai percorsi privati.
  if (invoice.url) {
    const response = await fetch(invoice.url);
    if (!response.ok) throw new Error(`Download fattura non riuscito (HTTP ${response.status}).`);
    return response.blob();
  }
  if (!invoice.storagePath) throw new Error("Percorso della fattura non disponibile.");
  await firebaseReady;
  if (!storage) throw new Error("Archivio fatture non disponibile.");
  const { getBlob, ref } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  return getBlob(ref(storage, invoice.storagePath));
}

export async function deleteOrderInvoiceFile(invoice) {
  if (!invoice?.storagePath || isFirebaseLocal || !storage) return;
  await firebaseReady;
  const { deleteObject, ref } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  await deleteObject(ref(storage, invoice.storagePath));
}

async function uploadImage(file, folder) {
  if (!file) return "";

  const dataUrl = await imageFileToOptimizedDataUrl(file);

  await firebaseReady;
  if (isFirebaseLocal || !storage) {
    return dataUrl;
  }

  const { getDownloadURL, ref, uploadString } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  const uploadId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "_").toLowerCase();
  const storageRef = ref(storage, `${folder}/${uploadId}_${safeName}`);

  await uploadString(storageRef, dataUrl, "data_url");
  return getDownloadURL(storageRef);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function imageFileToOptimizedDataUrl(file) {
  if (!file.type?.startsWith("image/")) {
    return fileToDataUrl(file);
  }

  const sourceDataUrl = await fileToDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const maxSize = 2000;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.84);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
