// 08_events.js — Operator actions, imports/exports, dynamic bindings, and event handlers
// Wires UI events to workflow mutations and persistence calls.

// ── Domain Pack Management ──

async function scanDomainPacks() {
  if (!workspaceSubHandles.prompts) return [];
  const packs = [];
  try {
    for await (const [name, handle] of workspaceSubHandles.prompts.entries()) {
      if (handle.kind !== "directory") continue;
      let hasPrompt = false;
      try {
        for await (const [childName] of handle.entries()) {
          if (/^0[1-6][_\s\-]/.test(childName) && childName.endsWith(".txt")) { hasPrompt = true; break; }
        }
      } catch(e) {}
      if (hasPrompt) packs.push(name);
    }
  } catch(e) { console.warn("Domain pack scan failed", e); }
  return packs.sort();
}

async function loadDomainPack(packName) {
  if (!workspaceSubHandles.prompts || !packName) return { loaded: 0, errors: [] };
  let packDir;
  try {
    packDir = await workspaceSubHandles.prompts.getDirectoryHandle(packName);
  } catch(e) {
    return { loaded: 0, errors: [`Pack directory "${packName}" not found.`] };
  }
  const loaded = [];
  const errors = [];
  try {
    for await (const [name, handle] of packDir.entries()) {
      if (handle.kind !== "file") continue;
      if (!/^0[1-6][_\s\-]/.test(name) || !name.endsWith(".txt")) continue;
      try {
        const file = await handle.getFile();
        const text = await file.text();
        if (text.trim()) loaded.push({ name, text: text.trim(), sourceMode: "domain-pack" });
      } catch(e) { errors.push(`Failed to read ${name}: ${e.message}`); }
    }
  } catch(e) { errors.push(`Failed to iterate pack: ${e.message}`); }
  // Clear existing prompt reference files and replace with pack contents
  state.referenceFiles = (state.referenceFiles || []).filter(f => !isPromptReferenceFile(f));
  loaded.forEach(item => upsertReferenceFile(item));
  state.activeDomainPack = packName;
  await saveState("domain pack loaded: " + packName).catch(e => console.warn("Persistence failed", e));
  return { loaded: loaded.length, errors };
}

async function unloadDomainPack() {
  state.referenceFiles = (state.referenceFiles || []).filter(f => !isPromptReferenceFile(f));
  state.activeDomainPack = "";
  await saveState("domain pack unloaded").catch(e => console.warn("Persistence failed", e));
}


const debouncedKeystrokeSave = debounce((origin) => {
  saveState(origin, { audit: false }).catch(err => console.error("Persistence failed", err));
}, 1500);

function clearPackageData(key) {
  const pkg = state.stage4.packages[key];
  if (!pkg) return;
  const label = pkg.packageId || pkg.packageLabel || pkg.filename || key;
  const hadImpl = Boolean(pkg.implementationOutputText.trim());
  const hadReview = Boolean(pkg.reviewOutputText.trim());
  const artifactIds = normalizeAuditArtifactIds([pkg.packageArtifactId, pkg.implementationArtifactId, pkg.reviewArtifactId]);
  const fresh = createEmptyPackageRecord(pkg.filename, pkg.packageText);
  state.stage4.packages[key] = {
    ...fresh,
    packageId: pkg.packageId,
    packageLabel: pkg.packageLabel,
    objective: pkg.objective,
    dependsOnIds: pkg.dependsOnIds
  };
  state.stage6 = createDefaultState().stage6;

  // Supersede all package-owned artifacts for cleared package
  const packageClearedAt = nowStamp();
  const supersedableTypes = new Set(["implementation_file", "implementation_output", "review_report"]);
  manifestArtifactList(state).forEach(record => {
    if (
      supersedableTypes.has(record.artifactType) &&
      record.packageKey === key &&
      record.status === "current"
    ) {
      record.status = "superseded";
      record.statusReason = `Superseded by package clear at ${packageClearedAt}.`;
      record.supersededByArtifactId = record.supersededByArtifactId || `package_clear:${key}:${packageClearedAt}`;
    }
  });

  const cleared = [hadImpl ? "implementation output" : "", hadReview ? "review" : ""].filter(Boolean);
  setActionSummary(`Cleared ${label}: ${cleared.length ? cleared.join(" and ") + " superseded" : "reset to initial state"}. Ready for a fresh Stage 04 request.`);

  saveState("package data cleared", {
    auditEvent: "PACKAGE_CLEARED",
    artifactIds,
    message: `Cleared saved package data for ${label}.`
  }).catch(err => console.error("Persistence failed", err));
  render();
}

function clearStage(stageKey) {
  const selectedPackage = getSelectedPackage();
  const stageArtifactMap = {
    stage1: normalizeAuditArtifactIds([state.stage1.currentArtifactId, state.stage2.currentArtifactId, state.stage3.bundleArtifactId]),
    stage2: normalizeAuditArtifactIds([state.stage2.currentArtifactId, state.stage3.bundleArtifactId]),
    stage3: normalizeAuditArtifactIds([state.stage3.bundleArtifactId, ...(state.stage3.artifacts || []).map(item => item.artifactId)]),
    stage4: normalizeAuditArtifactIds([
      ...(Object.values(state.stage4.packages || {}).map(pkg => [pkg.packageArtifactId, pkg.implementationArtifactId, pkg.reviewArtifactId]).flat())
    ]),
    stage6: normalizeAuditArtifactIds([state.stage6.mergeArtifactId])
  };
  if (stageKey === "stage1") {
    state.stage1 = createDefaultState().stage1;
    state.stage2 = createDefaultState().stage2;
    state.stage3 = createDefaultState().stage3;
    clearLateStages();
  } else if (stageKey === "stage2") {
    state.stage2 = createDefaultState().stage2;
    state.stage3 = createDefaultState().stage3;
    clearLateStages();
  } else if (stageKey === "stage3") {
    state.stage3 = createDefaultState().stage3;
    clearLateStages();
  } else if (stageKey === "stage4") {
    syncPackagesFromStage3();
    Object.keys(state.stage4.packages).forEach(key => {
      state.stage4.packages[key] = createEmptyPackageRecord(state.stage4.packages[key].filename, state.stage4.packages[key].packageText);
    });
    state.stage6 = createDefaultState().stage6;
  } else if (stageKey === "stage6") {
    state.stage6 = createDefaultState().stage6;
  }
  saveState("stage cleared", {
    auditEvent: "STAGE_CLEARED",
    artifactIds: stageArtifactMap[stageKey] || normalizeAuditArtifactIds([selectedPackage?.implementationArtifactId, selectedPackage?.reviewArtifactId]),
    message: `Cleared saved data for ${stageKey.toUpperCase()}.`
  }).catch(err => console.error("Persistence failed", err));
  render();
}

function downloadAllSavedArtifacts() {
  if (workspaceRootHandle) {
    if (!confirm("All artifacts are already saved in your workspace folder. Download extra copies to a different location?")) return;
  }
  if (state.stage1.artifactText.trim()) downloadText("01_Master_Briefing.txt", state.stage1.artifactText);
  if (state.stage2.artifactText.trim()) downloadText("02_Architecture_Spec.txt", state.stage2.artifactText);
  if (state.stage3.artifacts.length) {
    state.stage3.artifacts.forEach((artifact, index) => {
      setTimeout(() => downloadText(artifact.filename, artifact.content), 120 * (index + 1));
    });
  } else if (state.stage3.rawOutputText.trim()) {
    downloadText(state.stage3.outcome === "pause" ? "03_Pause_For_Decisions.txt" : "03_Stage03_Output.txt", state.stage3.rawOutputText);
  }
  let offset = 8;
  getPackagesInOrder().forEach(pkg => {
    if (pkg.implementationOutputText.trim()) {
      const base = pkg.filename.replace(/\.txt$/i, "");
      setTimeout(() => downloadText(`${base}_Stage04_Output.txt`, pkg.implementationOutputText), 120 * (offset + 1));
      offset += 1;
    }
    if (pkg.reviewOutputText.trim()) {
      const base = pkg.filename.replace(/\.txt$/i, "");
      setTimeout(() => downloadText(`${base}_Stage05_Review.txt`, pkg.reviewOutputText), 120 * (offset + 1));
      offset += 1;
    }
  });
  if (state.stage6.mergeResultText.trim()) {
    setTimeout(() => downloadText("06_Integration_Report.txt", state.stage6.mergeResultText), 120 * (offset + 1));
  }
}

function exportBackup() {
  if (workspaceRootHandle) {
    if (!confirm("The workspace state is already saved on disk. Export a portable backup copy anyway?")) return;
  }
  ensureProvenanceReconciled("restored from saved session");
  const payload = {
    backupVersion: BACKUP_VERSION,
    exportedAt: nowStamp(),
    state: serializeStateForPersistence(state)
  };
  const serialized = JSON.stringify(payload, null, 2);
  downloadText("09_Operator_Console_REBUILT_STAGE01_TO_06_workspace_backup.json", serialized);
  setWorkspaceStatus(`Backup exported (${formatBytes(byteLengthOfText(serialized))})`, "success");
  render();
}

function importBackupFromFile(file) {
  if (!file) return;
  if (Number(file.size || 0) > SECURITY_LIMITS.maxBackupImportBytes) {
    const message = limitMessage(safeImportedFilename(file.name, "Backup file"), Number(file.size || 0), SECURITY_LIMITS.maxBackupImportBytes);
    setWorkspaceStatus(message, "danger");
    render();
    alert(message);
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const rawText = String(reader.result || "{}");
      const rawBytes = byteLengthOfText(rawText);
      if (rawBytes > SECURITY_LIMITS.maxBackupImportBytes) throw new Error(limitMessage(safeImportedFilename(file.name, "Backup file"), rawBytes, SECURITY_LIMITS.maxBackupImportBytes));
      const parsed = JSON.parse(rawText);
      const importedState = isPlainObject(parsed?.state) ? parsed.state : parsed;
      const normalized = normalizeImportedState(importedState);
      Object.assign(state, createDefaultState(), normalized);
      const saved = await saveState("restored from saved session", { audit: false });
      if (saved) {
        await appendAuditEntry(buildAuditEntry("BACKUP_IMPORTED", {
          message: `Backup imported from ${safeImportedFilename(file.name)}.`,
          outcome: "success"
        }));
      }
      setWorkspaceStatus(saved ? `Backup imported safely from ${safeImportedFilename(file.name)}.` : `Backup imported from ${safeImportedFilename(file.name)}, but persistence failed.`, saved ? "success" : "danger");
      render();
    } catch (error) {
      console.error(error);
      const message = safeText(error?.message).trim() || "The selected backup file could not be read safely.";
      setWorkspaceStatus(message, "danger");
      render();
      alert(message);
    }
  };
  reader.onerror = () => {
    const message = "The selected backup file could not be read.";
    setWorkspaceStatus(message, "danger");
    alert(message);
  };
  reader.readAsText(file);
}

function upsertReferenceFile(item) {
  const nextItem = {
    sourceMode: item.sourceMode || "manual-import",
    ...item,
    name: safeImportedFilename(item.name, "Imported_Reference.txt")
  };
  const promptStageKey = stageKeyForReferenceFile(nextItem);
  if (promptStageKey) {
    const promptItem = { ...nextItem, promptStageKey };
    const existingIndex = state.referenceFiles.findIndex(file => (file.promptStageKey || stageKeyForReferenceFile(file)) === promptStageKey);
    if (existingIndex >= 0) state.referenceFiles[existingIndex] = { ...state.referenceFiles[existingIndex], ...promptItem };
    else state.referenceFiles.push(promptItem);
  } else {
    delete nextItem.promptStageKey;
    const existingIndex = state.referenceFiles.findIndex(file => file.name === nextItem.name);
    if (existingIndex >= 0) state.referenceFiles[existingIndex] = { ...state.referenceFiles[existingIndex], ...nextItem };
    else state.referenceFiles.push(nextItem);
  }

  if (nextItem.text) {
    persistReferenceFile(nextItem.name, nextItem.text).catch(e =>
      console.warn("Reference persistence failed", e)
    );
  }
}

function attachReferenceFiles(fileList, sourceMode = "manual-import") {
  const files = Array.from(fileList || []);
  if (!files.length) return Promise.resolve({ loaded: 0, promptLoaded: 0, rejected: 0 });
  const validation = validateTextFileBatch(files, sourceMode === "folder-import" ? "selected text files" : "selected files");
  if (!validation.ok) {
    setWorkspaceStatus(validation.message, "danger");
    alert(validation.message);
    return Promise.resolve({ loaded: 0, promptLoaded: 0, rejected: files.length });
  }
  return Promise.all(files.map(file => readFileAsText(file, sourceMode))).then(results => {
    const accepted = results.filter(item => item && !item.error);
    const rejected = results.filter(item => item?.error);
    accepted.forEach(item => upsertReferenceFile(item));
    if (rejected.length) {
      setWorkspaceStatus(`Imported ${accepted.length} file(s). Skipped ${rejected.length} file(s) that failed validation or reading.`, accepted.length ? "warn" : "danger");
    } else if (accepted.length) {
      setWorkspaceStatus(`Imported ${accepted.length} file(s) safely.`, "success");
    } else {
      setWorkspaceStatus("No files were imported.", "warn");
    }
    saveState("reference files imported").catch(err => console.error("Persistence failed", err));
    render();
    return {
      loaded: accepted.length,
      promptLoaded: accepted.filter(item => isPromptReferenceFile(item)).length,
      rejected: rejected.length
    };
  });
}

function readFileAsText(file, sourceMode = "manual-import") {
  return new Promise(resolve => {
    const size = Number(file?.size || 0);
    if (size > SECURITY_LIMITS.maxSingleTextFileBytes) {
      resolve({ error: limitMessage(safeImportedFilename(file?.name, "Selected file"), size, SECURITY_LIMITS.maxSingleTextFileBytes) });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const actualBytes = byteLengthOfText(text);
      if (actualBytes > SECURITY_LIMITS.maxSingleTextFileBytes) {
        resolve({ error: limitMessage(safeImportedFilename(file?.name, "Selected file"), actualBytes, SECURITY_LIMITS.maxSingleTextFileBytes) });
        return;
      }
      resolve({
        name: safeImportedFilename(file.name, "Imported_Reference.txt"),
        text,
        size: actualBytes,
        lastModified: file.lastModified,
        sourceMode
      });
    };
    reader.onerror = () => resolve({ error: `The file ${safeImportedFilename(file?.name, "Selected file")} could not be read as text inside the browser.` });
    reader.readAsText(file);
  });
}

function setupTextareaFileImport(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  if (textarea.dataset.fileImportReady) return;
  textarea.dataset.fileImportReady = "true";

  async function readAndAppendFiles(files, source) {
    if (!files || !files.length) return;
    const fileArray = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    const chunks = [];
    const errors = [];
    for (const file of fileArray) {
      try {
        const result = await readFileAsText(file, source);
        if (result?.error) {
          errors.push(`${file.name}: ${result.error}`);
        } else if (result?.text) {
          chunks.push(result.text);
        }
      } catch (error) {
        errors.push(`${file.name}: ${error?.message || "unknown error"}`);
      }
    }
    if (errors.length) alert("Could not read:\n" + errors.join("\n"));
    if (!chunks.length) return;
    const combined = chunks.join("\n\n");
    const existing = textarea.value.trim();
    textarea.value = existing ? existing + "\n\n" + combined : combined;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.scrollTop = textarea.scrollHeight;
  }

  const wrapper = textarea.closest(".field") || textarea.parentElement;
  if (wrapper) {
    const importRow = document.createElement("div");
    importRow.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;";
    importRow.innerHTML = `
      <button class="ghost-btn" type="button" style="padding:6px 12px;font-size:0.85rem;">Load from file(s)</button>
      <span class="mini" style="color:var(--muted);">or drag & drop text files onto the field above (multi-select supported, appends)</span>
    `;
    const fileBtn = importRow.querySelector("button");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".txt,.md,.json,.py,.js,.ts,.html,.css,.xml,.yaml,.yml,.toml,.csv,.log,.rst,.cfg,.ini,.sh,.bat";
    fileInput.multiple = true;
    fileInput.hidden = true;
    importRow.appendChild(fileInput);

    fileBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      await readAndAppendFiles(fileInput.files, "file-import");
      fileInput.value = "";
    });

    wrapper.appendChild(importRow);
  }

  textarea.addEventListener("dragover", event => {
    event.preventDefault();
    textarea.style.borderColor = "var(--accent)";
    textarea.style.background = "rgba(110, 231, 183, 0.06)";
  });

  textarea.addEventListener("dragleave", () => {
    textarea.style.borderColor = "";
    textarea.style.background = "";
  });

  textarea.addEventListener("drop", async event => {
    event.preventDefault();
    textarea.style.borderColor = "";
    textarea.style.background = "";
    await readAndAppendFiles(event.dataTransfer?.files, "file-drop");
  });
}

async function importFilesIntoPackage(pkg, files) {
  if (!workspaceRootHandle || !pkg || !files.length) return { imported: 0, failed: 0 };

  const totalBytes = files.reduce((sum, file) => sum + Math.max(0, Number(file?.size || 0) || 0), 0);
  if (totalBytes > SECURITY_LIMITS.maxBatchImportBytes) {
    return {
      imported: 0,
      failed: files.length,
      error: limitMessage("Selected files", totalBytes, SECURITY_LIMITS.maxBatchImportBytes)
    };
  }

  let imported = 0;
  let failed = 0;
  const stageDir = workspaceSubHandles["stage04"];
  if (!stageDir) return { imported: 0, failed: files.length };

  for (const file of files) {
    try {
      const result = await readFileAsText(file, "file-import");
      if (result?.error) {
        console.warn("Skipped file:", result.error);
        failed += 1;
        continue;
      }
      const fileText = result?.text || "";
      if (!fileText.trim()) {
        failed += 1;
        continue;
      }

      const safePkgKey = sanitizeFilenameSegment(pkg.packageId || pkg.key || "pkg", 30);
      const safeFileName = safeImportedFilename(file.name, "imported_file.txt");
      const diskFilename = `${safePkgKey}__${safeFileName}`;
      const relativePath = `stage04/${diskFilename}`;
      const parentArtifactIds = [pkg.packageArtifactId, pkg.implementationArtifactId].filter(Boolean);
      const logicalKey = `implementation_file:${pkg.key}:${safeFileName}`;

      await writeTextFile(stageDir, diskFilename, fileText);
      const hash = await computeContentHash(fileText);

      ensureManifestStructure(state);
      const previousHead = manifestArtifactList(state)
        .filter(record => record.logicalKey === logicalKey)
        .sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0))[0] || null;

      const artifactId = createOrReuseArtifactRecord(state, {
        currentArtifactId: previousHead?.artifactId || "",
        previousHeadId: previousHead?.artifactId || "",
        artifactType: "implementation_file",
        logicalKey,
        stageProduced: "Stage 04",
        text: fileText,
        title: `${pkg.packageId || pkg.key} — ${file.name}`,
        filename: file.name,
        packageKey: pkg.key,
        packageId: pkg.packageId || "",
        parentArtifactIds,
        consumedArtifactIds: [],
        consumingStageContext: "Imported implementation file attached to the current package workspace context.",
        sourceOrigin: "file-import",
        attributes: {
          originalFilename: file.name,
          fileSize: file.size,
          workspaceFilename: diskFilename
        }
      });

      const record = getManifestArtifact(artifactId, state);
      if (record) {
        record.relativePath = relativePath;
        record.contentHash = hash;
        record.promptSnapshotPath = safeText(record.promptSnapshotPath).trim();
      }

      await appendAuditEntry(buildAuditEntry("ARTIFACT_SAVED", {
        artifactIds: [artifactId],
        paths: [relativePath],
        message: `Implementation file imported: ${file.name} for ${pkg.packageId || pkg.key}`,
        outcome: "success"
      }));

      imported += 1;
    } catch (error) {
      console.error("File import failed for", file?.name, error);
      failed += 1;
    }
  }

  if (imported > 0) {
    reconcileArtifactStatuses(state);
    await persistManifest(state.manifest);
    await saveState("implementation files imported", {
      auditEvent: "ARTIFACT_SAVED",
      message: `${imported} implementation file(s) imported for ${pkg.packageId || pkg.key}`
    }).catch(() => {});
  }

  return { imported, failed };
}

function missingPromptHints(stageKeys) {
  return (stageKeys || []).map(stageKey => {
    const rule = STAGE_PROMPT_IMPORTS[stageKey];
    return `${rule.label} (${rule.number}_*.txt)`;
  });
}

async function collectPromptFileHandlesFromDirectory(handle) {
  const fileHandles = [];
  for await (const entry of handle.values()) {
    if (entry.kind === "file" && /\.txt$/i.test(entry.name || "")) fileHandles.push(entry);
  }
  return fileHandles;
}

async function loadPromptFilesFromDirectoryHandle(handle) {
  const fileHandles = await collectPromptFileHandlesFromDirectory(handle);
  const files = [];
  for (const fileHandle of fileHandles) {
    try {
      files.push(await fileHandle.getFile());
    } catch (error) {}
  }
  const validation = validateTextFileBatch(files, "selected prompt folder");
  if (!validation.ok) throw new Error(validation.message);

  const loadedItems = [];
  for (const file of files) {
    const item = await readFileAsText(file, "folder-import");
    if (!item?.error) loadedItems.push(item);
  }

  let loaded = 0;
  const missingStageKeys = [];
  const duplicateWarnings = [];
  for (const stageKey of STAGE_PROMPT_KEYS) {
    const matches = loadedItems.filter(item => stageKeyFromFilename(item) === stageKey && safeText(item.text).trim());
    if (!matches.length) {
      missingStageKeys.push(stageKey);
      continue;
    }
    if (matches.length > 1) {
      const rule = STAGE_PROMPT_IMPORTS[stageKey];
      const names = matches.map(f => safeText(f.name)).join(", ");
      duplicateWarnings.push(`${rule.label}: ${matches.length} files found (${names}). Using the newest.`);
    }
    matches.sort((a, b) => Number(b?.lastModified || 0) - Number(a?.lastModified || 0));
    upsertReferenceFile(matches[0]);
    loaded += 1;
  }
  if (duplicateWarnings.length) {
    console.warn("Duplicate prompt files detected:\n" + duplicateWarnings.join("\n"));
  }
  setWorkspaceStatus(loaded ? `Imported ${loaded} stage prompt file(s) safely.${duplicateWarnings.length ? ` Warning: ${duplicateWarnings.length} stage(s) had duplicate files.` : ""}` : "No matching stage prompt files were imported.", loaded ? (duplicateWarnings.length ? "warn" : "success") : "warn");
  // C1: Try loading pipeline_protocol_v1.json from the same folder
  const protocolLoaded = await tryLoadProtocolFromFolder(handle);
  if (protocolLoaded) {
    console.log("Protocol-derived constants applied (STAGE_PROMPT_IMPORTS, PLAUSIBILITY_RULES labels, expectAnywhere).");
  }
  saveState("prompt files imported").catch(err => console.error("Persistence failed", err));
  render();
  return { loaded, missingStageKeys };
}

async function tryAutoLoadSiblingPromptFiles() {
  const missingStageKeys = STAGE_PROMPT_KEYS.filter(stageKey => !hasUsableStagePrompt(stageKey));
  if (!missingStageKeys.length) return { attempted: false, loaded: 0, missingStageKeys: [] };

  // Try to restore cached prompt folder handle
  if (!promptFolderHandle) {
    const restored = await tryRestorePromptFolderHandle();
    if (!restored) return { attempted: false, loaded: 0, missingStageKeys };
  }

  try {
    const result = await loadPromptFilesFromDirectoryHandle(promptFolderHandle);
    if (result.loaded) {
      setWorkspaceStatus(`Loaded ${result.loaded} prompt file(s) from "${promptFolderHandle.name}".`, "success");
      saveState("prompt files auto-loaded").catch(err => console.error("Persistence failed", err));
      render();
    }
    return result;
  } catch (e) {
    console.warn("Auto-load from cached prompt folder failed", e);
    return { attempted: true, loaded: 0, missingStageKeys };
  }
}

async function loadAccompanyingPromptFiles() {
  if (window.showDirectoryPicker) {
    try {
      const result = await selectPromptFolder();
      if (!result.available) return;
      const loadResult = await loadPromptFilesFromDirectoryHandle(promptFolderHandle);
      const missingText = loadResult.missingStageKeys.length ? ` Missing: ${missingPromptHints(loadResult.missingStageKeys).join(", ")}` : "";
      alert(loadResult.loaded
        ? `Imported ${loadResult.loaded} matching stage prompt file(s) from "${promptFolderHandle.name}".${missingText} Only content-confirmed files become ready.`
        : `No matching stage prompt files were imported from "${promptFolderHandle.name}".${missingText}`);
    } catch (error) {
      if (error?.name !== "AbortError") {
        const message = safeText(error?.message).trim() || "The selected prompt folder could not be read.";
        setWorkspaceStatus(message, "danger");
        render();
        alert(message);
      }
    }
    return;
  }
  document.getElementById("promptFolderInput")?.click();
}

function promptReady(stageKey) {
  if (hasUsableStagePrompt(stageKey)) return true;
  alert(missingStagePromptMessage(stageKey));
  return false;
}

function resetMergeState() {
  // Note: createDefaultState().stage6 includes a fresh clusterPlan object,
  // so this reset also clears any active cluster merge state.
  const priorMergeArtifactId = state.stage6.mergeArtifactId;
  const hadMergeState = Boolean(
    safeText(state.stage6.requestText).trim() ||
    safeText(state.stage6.mergeResultText).trim() ||
    safeText(priorMergeArtifactId).trim() ||
    (state.stage6.includedPackageKeys || []).length
  );
  state.stage6 = createDefaultState().stage6;
  if (hadMergeState) {
    appendAuditEntry(buildAuditEntry("STAGE_CLEARED", {
      artifactIds: normalizeAuditArtifactIds([priorMergeArtifactId]),
      message: "Cleared saved Stage 06 merge state.",
      outcome: "success"
    })).catch(error => console.error("Audit logging failed", error));
  }
}

function setPacket(target, prefix, text) {
  target[`${prefix}Text`] = text;
  target[`${prefix}Prepared`] = true;
  target[`${prefix}Copied`] = false;
}

function clearPacket(target, prefix) {
  target[`${prefix}Text`] = "";
  target[`${prefix}Prepared`] = false;
  target[`${prefix}Copied`] = false;
}

// ── Runtime Protocol Loading (C1) ──
// Loads pipeline_protocol_v1.json from the prompt folder at runtime.
// Derives STAGE_PROMPT_IMPORTS and PLAUSIBILITY_RULES from the loaded protocol.
// Falls back to hardcoded values if the file is not found.

async function tryLoadProtocolFromFolder(dirHandle) {
  const PROTOCOL_FILENAME = "pipeline_protocol_v1.json";
  // Search order: prompt folder first, then workspace root.
  // This allows a single protocol file in the repo root to serve all domain packs.
  const candidates = [
    { handle: dirHandle, label: "prompt folder" },
    { handle: workspaceRootHandle, label: "workspace root" }
  ].filter(c => c.handle);

  for (const { handle, label } of candidates) {
    try {
      const fileHandle = await handle.getFileHandle(PROTOCOL_FILENAME);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const protocol = JSON.parse(text);
      if (!protocol?.version || !protocol?.stages) {
        console.warn(`Protocol file found in ${label} ("${handle.name}") but missing required fields (version, stages).`);
        continue;
      }
      loadedProtocol = protocol;
      applyLoadedProtocol(protocol);
      console.log(`Protocol v${protocol.version} loaded from ${label}: "${handle.name}/${PROTOCOL_FILENAME}"`);
      return true;
    } catch (e) {
      if (e?.name !== "NotFoundError") {
        console.warn(`Failed to load protocol from ${label}:`, e?.message || e);
      }
    }
  }
  console.log(`No ${PROTOCOL_FILENAME} found in prompt folder or workspace root — using hardcoded fallback.`);
  return false;
}

function applyLoadedProtocol(protocol) {
  // 1. Update version
  PROTOCOL_VERSION = protocol.version;
  if (protocol.calibration_date) PROTOCOL_CALIBRATION_DATE = protocol.calibration_date;

  // 2. Derive STAGE_PROMPT_IMPORTS from protocol stages
  for (const [stageKey, stageDef] of Object.entries(protocol.stages)) {
    if (STAGE_PROMPT_IMPORTS[stageKey]) {
      STAGE_PROMPT_IMPORTS[stageKey] = {
        label: stageDef.label || STAGE_PROMPT_IMPORTS_FALLBACK[stageKey]?.label || "",
        number: stageDef.number || STAGE_PROMPT_IMPORTS_FALLBACK[stageKey]?.number || ""
      };
    }
  }

  // 3. Derive PLAUSIBILITY_RULES labels and expectAnywhere from protocol
  for (const [stageKey, stageDef] of Object.entries(protocol.stages)) {
    if (!PLAUSIBILITY_RULES[stageKey]) continue;
    // Update label from artifact_produced
    if (stageDef.artifact_produced) {
      PLAUSIBILITY_RULES[stageKey].label = stageDef.artifact_produced;
    }
    // Rebuild expectAnywhere from frozen_tokens (pick tokens that are distinctive)
    if (stageDef.frozen_tokens?.length) {
      const regexes = stageDef.frozen_tokens
        .filter(t => t.length > 3 && !/^(CRITICAL_RULE|DO_NOT_BREAK|CRITICAL|MAJOR|MINOR|NOTE)$/.test(t))
        .slice(0, 4)
        .map(t => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"), "i"));
      if (regexes.length) {
        PLAUSIBILITY_RULES[stageKey].expectAnywhere = regexes;
      }
    }
  }

  // 4. Read review_mode (default: "gated")
  if (protocol.review_mode) {
    reviewMode = protocol.review_mode;
    console.log(`Review mode set to "${reviewMode}" from protocol.`);
  }

  // 5. Update protocol version display if render is available
  if (typeof render === "function") {
    try { render(); } catch (_) {}
  }
}

// ── Paste plausibility checks ──
// Protocol-derived fields (populated by applyLoadedProtocol if protocol is loaded):
//   label             ← protocol.stages[S].artifact_produced
//   expectAnywhere    ← protocol.stages[S].frozen_tokens (auto-generated regexes)
// Console-specific heuristics (always hardcoded):
//   wrongStageMarkers ← curated cross-stage detection patterns
//   expectStart/End   ← truncation and completeness heuristics

// checkPlausibilityProtocolAlignment — now uses loadedProtocol directly.
// If protocol was loaded at runtime, compares live protocol against PLAUSIBILITY_RULES.
// If not loaded, reports that no protocol file is available.
function checkPlausibilityProtocolAlignment() {
  const results = [];
  if (!loadedProtocol) {
    results.push({ stage: "global", check: "protocol_loaded", status: "WARN", detail: "No protocol file loaded — using hardcoded fallback values." });
    console.group("Plausibility ↔ Protocol alignment: no protocol loaded");
    console.warn("⚠️ No pipeline_protocol_v1.json loaded. Place it in the prompt folder for runtime validation.");
    console.groupEnd();
    return { pass: 0, fail: 0, warn: 1, results };
  }
  // Check each stage label matches
  for (const [stageKey, stageDef] of Object.entries(loadedProtocol.stages)) {
    const rules = PLAUSIBILITY_RULES[stageKey];
    if (!rules) {
      results.push({ stage: stageKey, check: "exists", status: "FAIL", detail: "No PLAUSIBILITY_RULES entry" });
      continue;
    }
    if (rules.label === stageDef.artifact_produced) {
      results.push({ stage: stageKey, check: "label", status: "PASS", detail: rules.label });
    } else {
      results.push({ stage: stageKey, check: "label", status: "FAIL",
        detail: `rules label "${rules.label}" ≠ protocol artifact_produced "${stageDef.artifact_produced}"` });
    }
  }
  results.push({ stage: "global", check: "protocol_version", status: "PASS",
    detail: `Loaded: v${loadedProtocol.version} (${loadedProtocol.calibration_date || "no date"})` });
  // Summary
  const fails = results.filter(r => r.status === "FAIL");
  const warns = results.filter(r => r.status === "WARN");
  const passes = results.filter(r => r.status === "PASS");
  console.group(`Plausibility ↔ Protocol alignment: ${passes.length} pass, ${fails.length} fail, ${warns.length} warn`);
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⚠️";
    console[r.status === "FAIL" ? "error" : r.status === "WARN" ? "warn" : "log"](
      `${icon} [${r.stage}] ${r.check}: ${r.detail}`
    );
  }
  console.groupEnd();
  return { pass: passes.length, fail: fails.length, warn: warns.length, results };
}

let PLAUSIBILITY_RULES = {
  stage1: {
    label: "Master Briefing",
    expectStart: [/master\s*briefing/i, /project\s*summary/i, /^#\s/],
    expectEnd: [/complexity|safety|readiness|pipeline\s*required|no\s*safety\s*concern/i],
    expectAnywhere: [/master\s*briefing/i],
    wrongStageMarkers: [
      { pattern: /FINAL_DISPOSITION/i, looks: "a Review Report (Stage 05)" },
      { pattern: /Integration\s*Report/i, looks: "an Integration Report (Stage 06)" },
      { pattern: /Work\s*Package\s*File/i, looks: "an orchestration artifact (Stage 03)" }
    ]
  },
  stage2: {
    label: "Architecture Spec",
    expectStart: [/architecture\s*spec/i, /system\s*overview/i, /^#\s/],
    expectEnd: [/progression\s*status|definitive\s*verdict|safety\s*assessment|no\s*safety\s*concern/i],
    expectAnywhere: [/architecture\s*spec/i, /component\s*inventory|canonical\s*shared/i],
    wrongStageMarkers: [
      { pattern: /FINAL_DISPOSITION/i, looks: "a Review Report (Stage 05)" },
      { pattern: /Delivery\s*Report/i, looks: "a Delivery Report (Stage 04)" }
    ]
  },
  stage3: {
    label: "Master Orchestration File + Work Packages",
    expectStart: [/master\s*orchestration|work\s*package|gate\s*result|pause/i, /^#\s/, /^filename:/i],
    expectEnd: [],
    expectAnywhere: [/work\s*package|master\s*orchestration|pause_for_decisions|execution\s*checklist/i],
    wrongStageMarkers: [
      { pattern: /FINAL_DISPOSITION/i, looks: "a Review Report (Stage 05)" },
      { pattern: /Delivery\s*Report[\s\S]{0,200}Requirement\s*IDs\s*addressed/i, looks: "a Delivery Report (Stage 04)" }
    ]
  },
  stage4: {
    label: "Delivery Report",
    expectStart: [],
    expectEnd: [/delivery\s*report|requirement\s*ids\s*addressed|contract\s*ids\s*obeyed|files\s*created|known\s*limitations/i],
    expectAnywhere: [],
    wrongStageMarkers: [
      { pattern: /FINAL_DISPOSITION/i, looks: "a Review Report (Stage 05)" },
      { pattern: /Integration\s*Report/i, looks: "an Integration Report (Stage 06)" },
      { pattern: /Progression\s*Status:\s*CLOSED/i, looks: "an Architecture Spec (Stage 02)" }
    ]
  },
  stage5: {
    label: "Review Report",
    expectStart: [],
    expectEnd: [/FINAL_DISPOSITION\s*:\s*(ACCEPT|REWORK)/i],
    expectAnywhere: [/FINAL_DISPOSITION/i, /REVIEW_BINDING_TOKEN/],
    wrongStageMarkers: [
      { pattern: /Integration\s*Report[\s\S]{0,300}Integration\s*Manifest/i, looks: "an Integration Report (Stage 06)" }
    ]
  },
  stage6: {
    label: "Integration Report",
    expectStart: [/integration\s*report|merge/i],
    expectEnd: [],
    expectAnywhere: [/integration\s*report|clean\s*merge|merged\s*with\s*fixes|blocked.*requires\s*rework/i, /REVIEW_BINDING_TOKEN/],
    wrongStageMarkers: [
      { pattern: /FINAL_DISPOSITION\s*:\s*(ACCEPT|REWORK)/i, looks: "a Review Report (Stage 05)" }
    ]
  }
};

function checkPastedPlausibility(stageKey, text) {
  const rules = PLAUSIBILITY_RULES[stageKey];
  if (!rules) return [];
  const warnings = [];
  const trimmed = text.trim();
  const head = trimmed.slice(0, 500);
  const tail = trimmed.slice(-500);

  // Check wrong stage markers first (most critical)
  for (const marker of (rules.wrongStageMarkers || [])) {
    if (marker.pattern.test(trimmed)) {
      warnings.push(`This text looks like it might be ${marker.looks}, not a ${rules.label}.`);
    }
  }

  // Check for expected content
  if (rules.expectAnywhere.length && !rules.expectAnywhere.some(rx => rx.test(trimmed))) {
    warnings.push(`Expected keywords for a ${rules.label} were not found anywhere in the text.`);
  }

  // Check ending (especially important for reviews with FINAL_DISPOSITION)
  if (rules.expectEnd.length && !rules.expectEnd.some(rx => rx.test(tail))) {
    warnings.push(`The end of this text does not look like a complete ${rules.label}.`);
  }

  // Truncation check: ends mid-word or mid-sentence without closing punctuation
  const lastChar = trimmed.slice(-1);
  const lastLine = trimmed.split("\n").filter(l => l.trim()).pop() || "";
  if (trimmed.length > 200 && !/[.!?\]\)`'"}\d]$/.test(lastLine.trim())) {
    warnings.push("The text may be truncated — it does not end with punctuation or a closing marker.");
  }

  // Suspiciously short
  if (trimmed.length < 150) {
    warnings.push(`This text is very short (${trimmed.length} characters) for a ${rules.label}.`);
  }

  return warnings;
}

function confirmPlausibility(stageKey, text) {
  const warnings = checkPastedPlausibility(stageKey, text);
  if (!warnings.length) return true;
  const message = "Plausibility check:\n\n" + warnings.map((w, i) => `${i + 1}. ${w}`).join("\n") + "\n\nSave anyway?";
  return confirm(message);
}

function validateClusterPlan(clusters) {
  // Expects: { A: { inputs: ["PKG_001", ...], round: 1 }, B: { inputs: [...], round: 1 }, AB: { inputs: ["CLUSTER_A", "CLUSTER_B"], round: 2 } }
  const errors = [];
  const warnings = [];

  if (!clusters || typeof clusters !== "object" || Array.isArray(clusters)) {
    errors.push("Plan must be a JSON object mapping cluster IDs to { inputs, round } objects.");
    return { ok: false, errors, warnings };
  }

  const ready = mergeReadyPackages();
  const readyKeys = new Set(ready.map(pkg => pkg.key));
  const readyIds = new Set(ready.map(pkg => pkg.packageId).filter(Boolean));
  const clusterIds = new Set(Object.keys(clusters));
  const packageAssignments = new Map();
  const clusterRefs = new Map(); // CLUSTER_X references → which cluster uses them
  let maxRound = 0;

  for (const [clusterId, cluster] of Object.entries(clusters)) {
    if (!cluster || typeof cluster !== "object" || Array.isArray(cluster)) {
      errors.push(`Cluster "${clusterId}" must be an object with { inputs, round }.`);
      continue;
    }
    if (!Array.isArray(cluster.inputs) || !cluster.inputs.length) {
      errors.push(`Cluster "${clusterId}" must have a non-empty inputs array.`);
      continue;
    }
    const round = cluster.round || 1;
    if (typeof round !== "number" || round < 1) {
      errors.push(`Cluster "${clusterId}" has invalid round: ${round}.`);
    }
    if (round > maxRound) maxRound = round;

    const packageInputs = cluster.inputs.filter(id => !String(id).startsWith("CLUSTER_"));
    const clusterInputs = cluster.inputs.filter(id => String(id).startsWith("CLUSTER_"));

    if (packageInputs.length > 3) {
      warnings.push(`Cluster "${clusterId}" has ${packageInputs.length} direct package inputs (recommended max: 3).`);
    }

    // Round 1 should reference packages; Round 2+ should reference CLUSTER_ outputs
    if (round === 1 && clusterInputs.length) {
      errors.push(`Round 1 cluster "${clusterId}" references other clusters — only Round 2+ clusters should use CLUSTER_ inputs.`);
    }
    if (round > 1 && packageInputs.length) {
      warnings.push(`Round ${round} cluster "${clusterId}" references raw packages — typically only CLUSTER_ inputs are expected in later rounds.`);
    }

    for (const inputId of packageInputs) {
      const matchesKey = readyKeys.has(inputId);
      const matchesId = readyIds.has(inputId);
      if (!matchesKey && !matchesId) {
        errors.push(`Package "${inputId}" in cluster "${clusterId}" is not merge-ready.`);
      }
      const resolvedKey = matchesKey ? inputId : [...readyKeys].find(k => {
        const pkg = state.stage4.packages[k];
        return pkg && pkg.packageId === inputId;
      }) || inputId;
      if (packageAssignments.has(resolvedKey)) {
        errors.push(`Package "${inputId}" is assigned to both "${packageAssignments.get(resolvedKey)}" and "${clusterId}".`);
      } else {
        packageAssignments.set(resolvedKey, clusterId);
      }
    }

    for (const ref of clusterInputs) {
      const refId = ref.replace("CLUSTER_", "");
      if (!clusterIds.has(refId)) {
        errors.push(`Cluster "${clusterId}" references CLUSTER_${refId}, but no cluster "${refId}" exists in the plan.`);
      }
      clusterRefs.set(refId, clusterId);
    }
  }

  // Verify all merge-ready packages are assigned in at least one Round 1 cluster
  for (const key of readyKeys) {
    const pkg = state.stage4.packages[key];
    const assignedByKey = packageAssignments.has(key);
    const assignedById = pkg?.packageId && packageAssignments.has(pkg.packageId);
    if (!assignedByKey && !assignedById) {
      errors.push(`Merge-ready package "${pkg?.packageId || key}" is not assigned to any cluster.`);
    }
  }

  // Verify the tree terminates: all Round 1 cluster outputs should eventually feed into a higher-round cluster
  if (maxRound > 1) {
    for (const [clusterId, cluster] of Object.entries(clusters)) {
      if ((cluster.round || 1) === 1 && !clusterRefs.has(clusterId)) {
        warnings.push(`Round 1 cluster "${clusterId}" is not consumed by any later-round cluster.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function readRequiredInput(id, message) {
  const value = safeText(document.getElementById(id)?.value).trim();
  if (!value) {
    alert(message);
    return value;
  }
  return value;
}

function getRequiredPackage(message = "Choose a package first.") {
  const pkg = getSelectedPackage();
  if (!pkg) alert(message);
  return pkg;
}

async function copyPacket(text, onSuccess) {
  const ok = await copyToClipboard(text);
  if (!ok) alert(COPY_FAIL_MESSAGE);
  if (onSuccess) onSuccess();
  finalizeRender();
}

function applyArchitectureSpec(value) {
  state.stage2.artifactText = value;
  state.stage2.savedAt = nowStamp();
  state.stage2.readinessStatus = parseReadinessStatus(value);
  state.stage2.progressionStatus = parseProgressionStatus(value);
  clearPacket(state.stage2, "retryRequest");
  state.stage3 = createDefaultState().stage3;
  clearLateStages();
}

function saveImplementationOutput(pkg, value) {
  pkg.implementationOutputText = value;
  pkg.implementationSavedAt = nowStamp();
  pkg.implementationOutputFingerprint = textFingerprint(value);
  pkg.implementationStatus = parseImplementationStatus(value);
  clearPacket(pkg, "implementationRequest");
  clearPacket(pkg, "reviewRequest");
  pkg.reviewUsable = pkg.reviewBoundFingerprint && pkg.reviewBoundFingerprint === pkg.implementationOutputFingerprint;
  resetMergeState();

  // Note: implementation_file artifacts are superseded by createOrReuseArtifactRecord
  // (same-filename replacement) and by clearPackageData (full package clear).
  // We do NOT blanket-supersede all implementation_files here because files imported
  // for the current implementation cycle would be incorrectly caught.
}

function saveReviewOutput(pkg, value) {
  pkg.reviewOutputText = value;
  pkg.reviewSavedAt = nowStamp();
  pkg.reviewBoundFingerprint = parseReviewBoundFingerprint(value);
  pkg.reviewDisposition = parseReviewDisposition(value);
  pkg.reviewVerdict = parseReviewVerdict(value);
  pkg.reviewUsable = Boolean(pkg.reviewBoundFingerprint && pkg.reviewBoundFingerprint === pkg.implementationOutputFingerprint);
  clearPacket(pkg, "reviewRequest");
  if (pkg.reviewUsable && pkg.reviewDisposition === "REWORK") clearPacket(pkg, "implementationRequest");
  resetMergeState();
}

function downloadCurrentRequest() {
  const key = currentActionKey();
  const pkg = getSelectedPackage();
  const map = {
    copyStage1: ["01_Stage01_Request.txt", state.stage1.requestText],
    copyStage2: ["02_Stage02_Request.txt", state.stage2.requestText],
    copyStage2Retry: ["02_Stage02_Retry_Request.txt", state.stage2.retryRequestText],
    copyStage3: ["03_Stage03_Request.txt", state.stage3.requestText],
    copyPauseResponse: ["03_Pause_Response_Packet.txt", state.stage3.pauseResponsePacketText],
    copyStage4: [`${pkg ? pkg.filename.replace(/\.txt$/i, "") : "04_Package"}_Stage04_Request.txt`, pkg ? pkg.implementationRequestText : ""],
    copyStage5: [`${pkg ? pkg.filename.replace(/\.txt$/i, "") : "05_Package"}_Stage05_Request.txt`, pkg ? pkg.reviewRequestText : ""],
    copyStage6: ["06_Merge_Request.txt", state.stage6.requestText]
  };
  const [filename, body] = map[key] || ["request.txt", ""];
  if (body) downloadText(filename, body);
}

function bindDynamicEvents() {
  const bindAttr = (selector, eventName, handler) => document.querySelectorAll(selector).forEach(el => el.addEventListener(eventName, event => handler(el, event)));

  bindAttr("#projectNameInput", "input", (_, event) => { state.projectName = event.target.value; debouncedKeystrokeSave("project name edited"); });
  bindAttr("#projectNotesInput", "input", (_, event) => { state.projectNotes = event.target.value; debouncedKeystrokeSave("project notes edited"); });
  bindAttr("#pauseAnswersInput", "input", (_, event) => { state.stage3.pauseAnswerDraft = event.target.value; debouncedKeystrokeSave("pause answers edited"); });

  bindIf("reconnectWorkspaceBtn", async () => {
    const ok = await reconnectWorkspace();
    if (ok) {
      const loaded = await loadPersistedWorkspaceState();
      if (loaded.found && loaded.state) {
        Object.assign(state, createDefaultState(), loaded.state);
        runtimeStatus._showResumeSummary = true;
        setPersistenceStatus(`Workspace reconnected from "${workspaceRootHandle.name}" (${formatBytes(loaded.bytes)})`, "success");
        await appendAuditEntry(buildAuditEntry("WORKSPACE_LOADED", {
          message: `Reconnected workspace from ${workspaceRootHandle.name}`,
          outcome: "success"
        }));
        const integrity = await checkWorkspaceIntegrity(state);
        if (!integrity.ok) {
          const names = integrity.missing.map(m => m.title).join(", ");
          await persistManifest(state.manifest);
          setWorkspaceStatus(`Warning: ${integrity.missing.length} artifact file(s) missing on disk: ${names}. These artifacts are marked as missing in the manifest.`, "warn");
        }
      } else {
        setPersistenceStatus(`Workspace reconnected to "${workspaceRootHandle.name}" — no saved state found`, "");
      }
      await syncWorkflowState("SELECT_WORKSPACE_ROOT");
      render();
      renderWorkspaceIndicator();
    } else {
      setPersistenceStatus("Permission was not granted. Try selecting the folder manually.", "warn");
      render();
    }
  });

  bindIf("selectWorkspaceFolderBtn", async () => {
    const result = await selectWorkspaceRoot();
    if (result.available) {
      const loaded = await loadPersistedWorkspaceState();
      if (loaded.found && loaded.state) {
        Object.assign(state, createDefaultState(), loaded.state);
        runtimeStatus._showResumeSummary = true;
        setPersistenceStatus(`Workspace loaded from "${workspaceRootHandle.name}"`, "success");
      } else if (hasLegacyLocalStorageData()) {
        if (confirm("Found saved workspace data from a previous console version in this browser. Import it into the new disk-backed workspace?")) {
          const migrated = await migrateLegacyLocalStorage();
          if (migrated) {
            setPersistenceStatus(`Legacy workspace migrated to "${workspaceRootHandle.name}"`, "success");
          } else {
            setPersistenceStatus(`Migration failed — starting fresh in "${workspaceRootHandle.name}"`, "warn");
          }
        } else {
          setPersistenceStatus(`New workspace in "${workspaceRootHandle.name}"`, "success");
        }
      } else {
        setPersistenceStatus(`New workspace in "${workspaceRootHandle.name}"`, "success");
      }
      await syncWorkflowState("SELECT_WORKSPACE_ROOT");
      render();
    }
  });
  bindAttr("#referenceFileInput", "change", (_, event) => {
    attachReferenceFiles(event.target.files, "manual-import");
    event.target.value = "";
  });
  bindAttr("#promptFolderInput", "change", (_, event) => {
    const promptFiles = Array.from(event.target.files || []).filter(file => /\.txt$/i.test(file.name || ""));
    attachReferenceFiles(promptFiles, "folder-import").then(result => {
      const missingStageKeys = STAGE_PROMPT_KEYS.filter(stageKey => !hasUsableStagePrompt(stageKey));
      const missingText = missingStageKeys.length ? ` Missing: ${missingPromptHints(missingStageKeys).join(", ")}` : "";
      if (result.loaded) alert(`Imported ${result.loaded} matching stage prompt file(s) from the selected folder.${missingText} Only content-confirmed files become ready.`);
      else alert(`No matching stage prompt files were imported from the selected folder.${missingText}`);
    });
    event.target.value = "";
  });
  bindAttr("[data-llm-id]", "change", (el, event) => {
    state.llms[el.getAttribute("data-llm-id")] = event.target.checked;
    if (!state.stage1.requestPrepared && !state.stage1.artifactText.trim()) state.setup.stage1ReadyConfirmed = false;
    finalizeRender();
  });
  bindAttr("[data-llm-label]", "input", (el, event) => {
    const id = el.getAttribute("data-llm-label");
    state.llmCatalog[id] = { ...(state.llmCatalog[id] || {}), label: event.target.value };
    saveState("llm label edited", { audit: false }).catch(err => console.error("Persistence failed", err));
  });
  bindAttr("[data-select-package]", "click", el => selectPackage(el.getAttribute("data-select-package")));
  bindAttr("[data-open-package-chooser]", "click", () => { state.stage4.selectedPackageKey = ""; finalizeRender(); });
  bindAttr("[data-download-request]", "click", downloadCurrentRequest);
  bindAttr("[data-download-single]", "click", el => {
    const file = { "01_Master_Briefing.txt": state.stage1.artifactText, "02_Architecture_Spec.txt": state.stage2.artifactText }[el.getAttribute("data-download-single")];
    if (file) downloadText(el.getAttribute("data-download-single"), file);
  });
  bindAttr("[data-download-artifact]", "click", el => {
    const artifact = state.stage3.artifacts.find(item => item.filename === el.getAttribute("data-download-artifact"));
    if (artifact) downloadText(artifact.filename, artifact.content);
  });
  bindAttr("[data-download-package-output]", "click", el => {
    const pkg = state.stage4.packages[el.getAttribute("data-download-package-output")];
    if (pkg?.implementationOutputText.trim()) downloadText(`${pkg.filename.replace(/\.txt$/i, "")}_Stage04_Output.txt`, pkg.implementationOutputText);
  });
  bindAttr("[data-download-package-review]", "click", el => {
    const pkg = state.stage4.packages[el.getAttribute("data-download-package-review")];
    if (pkg?.reviewOutputText.trim()) downloadText(`${pkg.filename.replace(/\.txt$/i, "")}_Stage05_Review.txt`, pkg.reviewOutputText);
  });
  bindAttr("[data-download-merge-result]", "click", () => state.stage6.mergeResultText.trim() && downloadText("06_Integration_Report.txt", state.stage6.mergeResultText));
  bindAttr("[data-clear-artifact]", "click", el => { if (confirm("Remove this saved artifact from the current workspace?")) clearStage(el.getAttribute("data-clear-artifact")); });
  bindAttr("[data-clear-package]", "click", el => {
    const key = el.getAttribute("data-clear-package");
    const pkg = state.stage4.packages[key];
    if (!pkg) return;
    const consequences = buildClearPackageConsequences(pkg);
    const message = consequences.length
      ? `Clear this package?\n\n${consequences.join("\n")}`
      : "Clear the saved implementation output and review for this package?";
    if (confirm(message)) clearPackageData(key);
  });
  bindAttr("[data-remove-ref]", "click", el => { state.referenceFiles = state.referenceFiles.filter(file => file.name !== el.getAttribute("data-remove-ref")); finalizeRender(); });
  bindAttr("[data-download-ref]", "click", el => {
    const file = state.referenceFiles.find(item => item.name === el.getAttribute("data-download-ref"));
    if (file) downloadText(file.name, file.text);
  });

  bindIf("prepareStage1Btn", () => {
    if (!hasUsableStagePrompt("stage1")) return alert(missingStagePromptMessage("stage1"));
    if (!hasTierBaseline()) return alert("Select at least one Tier 1 slot and one Tier 2 slot first.");
    state.setup.stage1ReadyConfirmed = true;
    finalizeRender();
  });
  bindIf("prepareStage1RequestBtn", async () => {
    if (!promptReady("stage1")) return;
    setPacket(state.stage1, "request", buildStage1Request());
    const snapshotPath = await writePromptSnapshot("stage1", getStagePromptText("stage1"));
    if (snapshotPath) state.stage1._lastPromptSnapshotPath = snapshotPath;
    finalizeRender();
  });
  bindIf("copyStage1Btn", () => copyPacket(state.stage1.requestText, () => { state.stage1.requestCopied = true; }));
  bindIf("SaveMasterBriefingBtn", () => {
    const value = readRequiredInput("stage1ReturnInput", "Paste the final Master Briefing first.");
    if (!value) return;
    if (!confirmPlausibility("stage1", value)) return;
    const isUpdate = Boolean(state.stage1.artifactText.trim());
    state.stage1.artifactText = value;
    state.stage1.savedAt = nowStamp();
    setActionSummary(isUpdate ? "Master Briefing updated. Downstream artifacts remain saved but may need re-evaluation." : "Master Briefing saved. The next step is to build the Stage 02 request.");
    finalizeRender();
  });

  bindIf("prepareStage2Btn", async () => {
    if (!promptReady("stage2")) return;
    setPacket(state.stage2, "request", buildStage2Request());
    const snapshotPath = await writePromptSnapshot("stage2", getStagePromptText("stage2"));
    if (snapshotPath) state.stage2._lastPromptSnapshotPath = snapshotPath;
    finalizeRender();
  });
  bindIf("copyStage2Btn", () => copyPacket(state.stage2.requestText, () => { state.stage2.requestCopied = true; }));
  bindIf("SaveArchitectureSpecBtn", () => {
    const value = readRequiredInput("stage2ReturnInput", "Paste the Architecture Spec first.");
    if (!value) return;
    if (!confirmPlausibility("stage2", value)) return;
    const isUpdate = Boolean(state.stage2.artifactText.trim());
    applyArchitectureSpec(value);
    if (architectureNeedsRetry()) {
      setActionSummary(`Architecture Spec saved but the readiness gate is blocked: ${describeArchitectureBlock()}`, "warn");
    } else {
      setActionSummary(isUpdate ? "Architecture Spec updated. The Stage 03 gate is open." : "Architecture Spec saved. The next step is to build the Stage 03 request.");
    }
    finalizeRender();
  });
  bindIf("prepareStage2RetryBtn", async () => {
    if (!promptReady("stage2")) return;
    state.stage2.retryReason = describeArchitectureBlock();
    setPacket(state.stage2, "retryRequest", buildStage2Request([
      "Please revise the current Architecture Spec so the downstream gate is operationally usable.",
      "Preserve unaffected contracts where possible.",
      "",
      "Current blocking reason:",
      describeArchitectureBlock(),
      "",
      "Current Architecture Spec to revise:",
      safeText(state.stage2.artifactText).trim()
    ].join("\n")));
    const snapshotPath = await writePromptSnapshot("stage2", getStagePromptText("stage2"));
    if (snapshotPath) state.stage2._lastPromptSnapshotPath = snapshotPath;
    state.stage2.progressionStatus = "";
    finalizeRender();
  });
  bindIf("copyStage2RetryBtn", () => copyPacket(state.stage2.retryRequestText, () => { state.stage2.retryRequestCopied = true; }));
  bindIf("SaverevisedArchitectureSpecBtn", () => {
    const value = readRequiredInput("stage2RetryInput", "Paste the revised Architecture Spec first.");
    if (!value) return;
    applyArchitectureSpec(value);
    if (architectureNeedsRetry()) {
      setActionSummary(`Revised Architecture Spec saved but the gate is still blocked: ${describeArchitectureBlock()}`, "warn");
    } else {
      setActionSummary("Revised Architecture Spec saved. The Stage 03 gate is now open.");
    }
    finalizeRender();
  });

  bindIf("prepareStage3Btn", async () => {
    if (!promptReady("stage3")) return;
    setPacket(state.stage3, "request", buildStage3Request(isStage3PausePrep() ? [
      "The current Architecture Spec signals PAUSE_FOR_DECISIONS.",
      "Run Stage 03 only to obtain the single PAUSE artifact.",
      "Do not generate implementation work packages in this run."
    ].join("\n") : ""));
    const snapshotPath = await writePromptSnapshot("stage3", getStagePromptText("stage3"));
    if (snapshotPath) state.stage3._lastPromptSnapshotPath = snapshotPath;
    finalizeRender();
  });
  bindIf("copyStage3Btn", () => copyPacket(state.stage3.requestText, () => { state.stage3.requestCopied = true; }));
  bindIf("SaveorchestrationresultBtn", () => {
    const value = readRequiredInput("stage3ReturnInput", "Paste the full Stage 03 result first.");
    if (!value) return;
    if (!confirmPlausibility("stage3", value)) return;
    commitStage3Result(value);
    const packages = getPackagesInOrder();
    if (state.stage3.outcome === "pause") {
      setActionSummary("Stage 03 result saved — PAUSE detected. Answer the decision questionnaire to continue.", "warn");
    } else if (state.stage3.outcome === "closed" && packages.length) {
      setActionSummary(`Stage 03 result saved — CLOSED. ${packages.length} work package${packages.length === 1 ? "" : "s"} detected. Ready for implementation.`);
    } else {
      setActionSummary("Stage 03 result saved.");
    }
  });
  bindIf("preparePauseResponseBtn", async () => {
    const answers = readRequiredInput("pauseAnswersInput", "Write your decision answers first.");
    if (!answers) return;
    state.stage3.pauseAnswerDraft = answers;
    setPacket(state.stage3, "pauseResponse", buildPauseResponsePacket());
    const pauseSnapshotStageKey = state.stage3.pauseResumeTarget || "stage3";
    const snapshotPath = await writePromptSnapshot(pauseSnapshotStageKey, getStagePromptText(pauseSnapshotStageKey));
    if (snapshotPath) state.stage3._lastPromptSnapshotPath = snapshotPath;
    finalizeRender();
  });
  bindIf("copyPauseResponseBtn", () => copyPacket(state.stage3.pauseResponsePacketText, () => {
    state.stage3.pauseResponseCopied = true;
    state.stage3.pauseWaitingForUpdatedResult = true;
  }));
  bindIf("SaveupdatedresultBtn", () => {
    const value = readRequiredInput("pauseReturnInput", "Paste the updated authoritative result first.");
    if (value) savePauseReturn(value);
  });

  bindIf("prepareStage4Btn", async () => {
    if (!promptReady("stage4")) return;
    const pkg = getRequiredPackage();
    if (!pkg) return;
    setPacket(pkg, "implementationRequest", buildStage4Request(pkg, pkg.reviewUsable && pkg.reviewDisposition === "REWORK" ? "rework" : "normal"));
    const snapshotPath = await writePromptSnapshot("stage4", getStagePromptText("stage4"));
    if (snapshotPath) pkg._lastPromptSnapshotPath = snapshotPath;
    resetMergeState();
    finalizeRender();
  });
  bindIf("copyStage4Btn", () => {
    const pkg = getRequiredPackage();
    if (pkg) copyPacket(pkg.implementationRequestText, () => { pkg.implementationRequestCopied = true; });
  });
  bindIf("SaveimplementationoutputBtn", () => {
    const pkg = getRequiredPackage();
    const value = readRequiredInput("stage4ReturnInput", "Paste the full implementation output first.");
    if (!pkg || !value) return;
    if (!confirmPlausibility("stage4", value)) return;
    const hadReview = pkg.reviewUsable;
    const hadOutput = Boolean(pkg.implementationOutputText.trim());
    saveImplementationOutput(pkg, value);
    const parts = [`Implementation output saved for ${pkg.packageId || pkg.filename}.`];
    if (hadOutput) parts.push("Previous output superseded.");
    if (hadReview) parts.push("Existing review is now stale — a new review is required.");
    setActionSummary(parts.join(" "));
    finalizeRender();
  });

  bindIf("prepareStage5Btn", async () => {
    if (!promptReady("stage5")) return;
    const pkg = getRequiredPackage();
    if (!pkg?.implementationOutputText.trim()) return alert("You cannot start review yet because this package has no saved implementation output.");
    setPacket(pkg, "reviewRequest", buildStage5Request(pkg));
    const snapshotPath = await writePromptSnapshot("stage5", getStagePromptText("stage5"));
    if (snapshotPath) pkg._lastPromptSnapshotPath = snapshotPath;
    resetMergeState();
    finalizeRender();
  });
  bindIf("copyStage5Btn", () => {
    const pkg = getRequiredPackage();
    if (pkg) copyPacket(pkg.reviewRequestText, () => { pkg.reviewRequestCopied = true; });
  });
  bindIf("SavereviewresultBtn", () => {
    const pkg = getRequiredPackage();
    const value = readRequiredInput("stage5ReturnInput", "Paste the full review report first.");
    if (!pkg || !value) return;
    if (!confirmPlausibility("stage5", value)) return;
    const hadReview = Boolean(pkg.reviewOutputText.trim());
    saveReviewOutput(pkg, value);
    const label = pkg.packageId || pkg.filename;
    if (pkg.reviewUsable && pkg.reviewDisposition === "ACCEPT") {
      setActionSummary(`Review saved for ${label} — ACCEPTED. This package is now eligible for Stage 06 merge.`);
    } else if (pkg.reviewUsable && pkg.reviewDisposition === "REWORK") {
      setActionSummary(`Review saved for ${label} — REWORK required. The next step is a revised Stage 04 implementation.`, "warn");
    } else if (!pkg.reviewUsable) {
      setActionSummary(`Review saved for ${label}, but the binding fingerprint does not match the current implementation output. A new review bound to the current output is needed.`, "warn");
    } else {
      setActionSummary(`Review saved for ${label}.${hadReview ? " Previous review replaced." : ""}`);
    }
    finalizeRender();
  });

  // ── Craft Review handlers (non-gating, only active when reviewMode === "structural+craft") ──

  bindIf("prepareCraftReviewBtn", () => {
    if (reviewMode !== "structural+craft") return;
    const pkg = getRequiredPackage();
    if (!pkg) return;
    if (!hasUsableStagePrompt("stage5")) return alert("Load a craft review prompt (05b_ prefix) to use craft review.");
    pkg.craftReviewRequestText = buildCraftReviewRequest(pkg);
    pkg.craftReviewRequestPrepared = true;
    pkg.craftReviewRequestCopied = false;
    finalizeRender();
  });
  bindIf("copyCraftReviewBtn", () => {
    const pkg = getRequiredPackage();
    if (pkg && pkg.craftReviewRequestText) copyPacket(pkg.craftReviewRequestText, () => { pkg.craftReviewRequestCopied = true; });
  });
  bindIf("SaveCraftReviewResultBtn", () => {
    const pkg = getRequiredPackage();
    const value = readRequiredInput("craftReviewReturnInput", "Paste the craft review feedback first.");
    if (!pkg || !value) return;
    pkg.craftReviewOutputText = value;
    pkg.craftReviewSavedAt = nowStamp();
    const label = pkg.packageId || pkg.filename;
    setActionSummary(`Craft review saved for ${label}. This is annotative feedback — it does not affect merge eligibility.`);
    saveState("craft review saved", {
      audit: true,
      auditEvent: { type: "CRAFT_REVIEW_SAVED", packageKey: pkg.key, packageId: pkg.packageId }
    }).catch(err => console.error("Persistence failed", err));
    finalizeRender();
  });
  bindIf("SaveCraftNotesBtn", () => {
    const pkg = getRequiredPackage();
    const value = readRequiredInput("craftNotesInput", "Enter your craft notes first.");
    if (!pkg || !value) return;
    pkg.craftNotesText = value;
    pkg.craftNotesSavedAt = nowStamp();
    const label = pkg.packageId || pkg.filename;
    setActionSummary(`Craft notes saved for ${label}.`);
    saveState("craft notes saved", {
      audit: true,
      auditEvent: { type: "CRAFT_NOTES_SAVED", packageKey: pkg.key, packageId: pkg.packageId }
    }).catch(err => console.error("Persistence failed", err));
    finalizeRender();
  });

  bindIf("chooseAnotherPackageBtn", () => { state.stage4.selectedPackageKey = ""; finalizeRender(); });
  ["prepareMergeBtn", "prepareMergeBtnAlt"].forEach(id => bindIf(id, prepareMergeFromCurrentState));
  bindIf("SaveMergeResultBtn", () => {
    const value = readRequiredInput("stage6ReturnInput", "Paste the full merge result first.");
    if (!value) return;
    if (!confirmPlausibility("stage6", value)) return;
    state.stage6.mergeResultText = value;
    state.stage6.mergeSavedAt = nowStamp();
    state.stage6.mergeVerdict = parseMergeVerdict(value);
    clearPacket(state.stage6, "request");
    const verdict = state.stage6.mergeVerdict;
    if (verdict) {
      setActionSummary(`Merge result saved — verdict: ${verdict}.`);
    } else {
      setActionSummary("Merge result saved.");
    }
    finalizeRender();
  });

  // ── Clustered Merge Handlers ──

  bindIf("prepareClusterPlanBtn", () => {
    if (!hasUsableStagePrompt("stage6")) return alert(missingStagePromptMessage("stage6"));
    const ready = mergeReadyPackages();
    if (!ready.length) return alert("No packages are currently eligible for Stage 06 merge.");

    // Build default suggestion: groups of 3 in round 1, binary tree in round 2+
    const ids = ready.map(pkg => pkg.packageId || pkg.key);
    const suggestion = {};
    const round1Ids = [];
    let ci = 1;
    for (let i = 0; i < ids.length; i += 3) {
      const clusterId = String.fromCharCode(64 + ci); // A, B, C, ...
      suggestion[clusterId] = { inputs: ids.slice(i, i + 3), round: 1 };
      round1Ids.push(clusterId);
      ci++;
    }
    // If >1 round-1 cluster, add a round-2 merge cluster
    if (round1Ids.length > 1) {
      const finalId = round1Ids.join("");
      suggestion[finalId] = { inputs: round1Ids.map(id => `CLUSTER_${id}`), round: 2 };
    }

    // Reset to default cluster plan (mode stays "standard" until validateAndStart)
    state.stage6.clusterPlan = createDefaultState().stage6.clusterPlan;
    syncWorkflowState("STAGE6_CLUSTER_PLAN");
    setActionSummary(`Cluster plan editor opened. ${ready.length} merge-ready package(s) to assign.`);
    finalizeRender();

    // Pre-fill the textarea after render creates it
    requestAnimationFrame(() => {
      const textarea = document.getElementById("clusterPlanInput");
      if (textarea && !textarea.value.trim()) {
        textarea.value = JSON.stringify(suggestion, null, 2);
      }
    });
  });

  bindIf("validateAndStartClusterBtn", () => {
    const raw = readRequiredInput("clusterPlanInput", "Paste or edit the cluster plan JSON first.");
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return alert("Invalid JSON: " + (e?.message || "parse error"));
    }
    const validation = validateClusterPlan(parsed);
    if (!validation.ok) return alert("Cluster plan invalid:\n\n" + validation.errors.join("\n"));
    if (validation.warnings.length) {
      if (!confirm("Cluster plan warnings:\n\n" + validation.warnings.join("\n") + "\n\nProceed anyway?")) return;
    }
    initializeClusterPlan(parsed);
    const firstCluster = state.stage6.clusterPlan.mergeOrder[0];
    if (firstCluster) {
      state.stage6.requestText = buildStage6ClusterRequest(firstCluster);
      state.stage6.requestPrepared = true;
      state.stage6.requestCopied = false;
    }
    saveState("cluster plan initialized", {
      auditEvent: "CLUSTER_PLAN_INITIALIZED",
      message: `Cluster merge plan initialized with ${state.stage6.clusterPlan.mergeOrder.length} cluster(s).`
    }).catch(err => console.error("Persistence failed", err));
    setActionSummary(`Cluster plan active — ${state.stage6.clusterPlan.mergeOrder.length} cluster(s). First cluster request is ready.`);
    finalizeRender();
  });

  bindIf("cancelClusterPlanBtn", () => {
    if (!confirm("Cancel the cluster plan and return to the standard merge flow?")) return;
    state.stage6.clusterPlan = createDefaultState().stage6.clusterPlan;
    clearPacket(state.stage6, "request");
    state.stage6.mergeResultText = "";
    state.stage6.mergeSavedAt = "";
    state.stage6.mergeVerdict = "";
    saveState("cluster plan cancelled", {
      auditEvent: "CLUSTER_PLAN_CANCELLED",
      message: "Cluster merge plan cancelled. Returned to standard merge flow."
    }).catch(err => console.error("Persistence failed", err));
    setActionSummary("Cluster plan cancelled. You can use standard merge or start a new cluster plan.");
    finalizeRender();
  });

  bindIf("buildClusterRequestBtn", async () => {
    if (!hasUsableStagePrompt("stage6")) return alert(missingStagePromptMessage("stage6"));
    const cp = state.stage6.clusterPlan;
    if (!cp || cp.mode !== "clustered") return alert("No active cluster plan.");
    const currentCluster = cp.currentCluster;
    if (!currentCluster) return alert("No current cluster to build a request for.");
    state.stage6.requestText = buildStage6ClusterRequest(currentCluster);
    state.stage6.requestPrepared = true;
    state.stage6.requestCopied = false;
    const snapshotPath = await writePromptSnapshot("stage6", getStagePromptText("stage6"));
    if (snapshotPath) state.stage6._lastPromptSnapshotPath = snapshotPath;
    saveState("cluster request built").catch(err => console.error("Persistence failed", err));
    finalizeRender();
  });

  bindIf("saveClusterMergeResultBtn", async () => {
    const value = readRequiredInput("clusterMergeReturnInput", "Paste the cluster merge result first.");
    if (!value) return;
    if (!confirmPlausibility("stage6", value)) return;
    const cp = state.stage6.clusterPlan;
    if (!cp || cp.mode !== "clustered") return alert("No active cluster plan.");
    const clusterId = cp.currentCluster;
    if (!clusterId) return alert("No current cluster.");

    const mergeVerdict = parseMergeVerdict(value);
    const isFailure = /blocked|requires\s*rework/i.test(mergeVerdict || "");

    // Create cluster_merge_output manifest artifact
    const cluster = cp.clusters?.[clusterId];
    const logicalKey = `cluster_merge_output:${clusterId}`;
    const previousHead = manifestArtifactList(state)
      .filter(r => r.logicalKey === logicalKey)
      .sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0))[0] || null;

    // Resolve parent artifact IDs from cluster inputs
    const parentArtifactIds = (cluster?.inputs || []).map(inputId => {
      if (inputId.startsWith("CLUSTER_")) {
        return findClusterMergeArtifactId(inputId.replace("CLUSTER_", "")) || "";
      }
      const pkg = getPackagesInOrder().find(p => p.packageId === inputId || p.key === inputId);
      return pkg?.implementationArtifactId || "";
    }).filter(Boolean);

    const artifactId = createOrReuseArtifactRecord(state, {
      currentArtifactId: previousHead?.artifactId || findClusterMergeArtifactId(clusterId) || "",
      previousHeadId: previousHead?.artifactId || "",
      artifactType: "cluster_merge_output",
      logicalKey,
      stageProduced: "Stage 06",
      text: value,
      title: `Cluster ${clusterId} merge output`,
      filename: `06_Cluster_${clusterId}_Merge.txt`,
      parentArtifactIds,
      consumedArtifactIds: [],
      consumingStageContext: `Clustered merge output for cluster ${clusterId}.`,
      sourceOrigin: "operator-paste",
      attributes: {
        clusterId,
        mergeRound: cluster?.round || 1,
        verdict: mergeVerdict || ""
      }
    });

    if (isFailure) {
      recordClusterFailure(clusterId);
      const canReplan = isReclusterUnlocked(clusterId);
      setActionSummary(
        `Cluster ${clusterId} merge failed — verdict: ${mergeVerdict}.` +
        (canReplan ? " Re-clustering is now unlocked for this cluster." : " Retry, or re-cluster unlocks after 2 consecutive failures."),
        "warn"
      );
    } else {
      if (!cp.completedClusters.includes(clusterId)) cp.completedClusters.push(clusterId);
      const remaining = cp.mergeOrder.filter(id => !cp.completedClusters.includes(id));
      if (remaining.length === 0) {
        setActionSummary(`Cluster ${clusterId} merge saved — all clusters complete. Ready to promote final result.`);
      } else {
        setActionSummary(`Cluster ${clusterId} merge saved — ${remaining.length} cluster(s) remaining.`);
      }
    }

    clearPacket(state.stage6, "request");
    reconcileArtifactStatuses(state);
    await persistManifest(state.manifest);
    await saveState("cluster merge result saved", {
      auditEvent: "ARTIFACT_SAVED",
      artifactIds: [artifactId],
      message: `Cluster ${clusterId} merge result saved. Verdict: ${mergeVerdict || "unknown"}.`
    }).catch(err => console.error("Persistence failed", err));
    finalizeRender();
  });

  bindIf("advanceClusterBtn", () => {
    const cp = state.stage6.clusterPlan;
    if (!cp || cp.mode !== "clustered") return alert("No active cluster plan.");
    advanceToNextCluster();
    clearPacket(state.stage6, "request");
    const next = cp.currentCluster;
    if (next) {
      setActionSummary(`Advanced to cluster ${next}. Build the request when ready.`);
    } else {
      setActionSummary("All clusters processed. You can promote the final result.");
    }
    saveState("advanced to next cluster").catch(err => console.error("Persistence failed", err));
    finalizeRender();
  });

  bindIf("promoteFinalClusterBtn", async () => {
    const cp = state.stage6.clusterPlan;
    if (!cp || cp.mode !== "clustered") return alert("No active cluster plan.");
    const lastCompleted = (cp.completedClusters || []).slice(-1)[0];
    if (!lastCompleted) return alert("No completed cluster to promote.");
    if (!confirm(`Promote cluster ${lastCompleted} output as the final merge result?`)) return;
    promoteClusterToFinalMerge(lastCompleted);
    state.stage6.mergeVerdict = parseMergeVerdict(state.stage6.mergeResultText);
    const verdict = state.stage6.mergeVerdict;
    setActionSummary(`Final merge result promoted from cluster ${lastCompleted}.${verdict ? " Verdict: " + verdict + "." : ""}`);
    await persistManifest(state.manifest);
    await saveState("cluster merge promoted to final", {
      auditEvent: "CLUSTER_MERGE_PROMOTED",
      message: `Cluster ${lastCompleted} promoted to final merge result.`
    }).catch(err => console.error("Persistence failed", err));
    finalizeRender();
  });

  bindIf("replanClustersBtn", () => {
    const cp = state.stage6.clusterPlan;
    if (!cp) return;
    if (!confirm("Re-open the cluster plan editor? Completed cluster results will be preserved.")) return;
    const preserved = (cp.completedClusters || []).slice();
    state.stage6.clusterPlan = {
      ...createDefaultState().stage6.clusterPlan,
      completedClusters: preserved
      // mode stays "standard" — re-enters planning state
    };
    clearPacket(state.stage6, "request");
    syncWorkflowState("STAGE6_CLUSTER_PLAN");
    saveState("cluster re-plan initiated", {
      auditEvent: "CLUSTER_REPLAN",
      message: `Cluster re-plan initiated. ${preserved.length} completed cluster(s) preserved.`
    }).catch(err => console.error("Persistence failed", err));
    setActionSummary(`Re-planning clusters. ${preserved.length} completed cluster(s) preserved.`);
    finalizeRender();
  });

  // ── End Clustered Merge Handlers ──

  bindIf("archiveStaleBtn", async () => {
    const archivable = manifestArtifactList(state).filter(r =>
      (r.status === "superseded" || r.status === "orphaned" || r.status === "stale") &&
      !new Set(currentHeadArtifactIds(state)).has(r.artifactId) &&
      r.relativePath &&
      !r.relativePath.startsWith("archive/")
    );
    if (!archivable.length) return;
    if (!confirm(`Move ${archivable.length} superseded/stale file${archivable.length === 1 ? "" : "s"} to the archive folder?`)) return;
    await archiveSupersededFiles(state);
    await persistManifest(state.manifest);
    setActionSummary(`Archived ${archivable.length} file${archivable.length === 1 ? "" : "s"}. Stage folders now contain only current artifacts.`);
    render();
  });

  bindIf("downloadManifestBtn", () => downloadText("09_Operator_Console_Artifact_Manifest.json", JSON.stringify(state.manifest, null, 2)));
  bindIf("downloadStage3SetBtn", () => state.stage3.rawOutputText.trim() ? downloadAllSavedArtifacts() : alert("No Stage 03 result is saved yet."));
  bindIf("downloadSummaryBtnInline", downloadAllSavedArtifacts);
  bindIf("loadPromptFolderBtn", loadAccompanyingPromptFiles);
  bindIf("importFilesBtn", () => document.getElementById("referenceFileInput")?.click());

  [
    "stage1ReturnInput",
    "stage2ReturnInput",
    "stage2RetryInput",
    "stage3ReturnInput",
    "pauseReturnInput",
    "stage4ReturnInput",
    "stage5ReturnInput",
    "stage6ReturnInput"
  ].forEach(id => setupTextareaFileImport(id));

  const dropZone = document.getElementById("packageFileDropZone");
  const packageFileInput = document.getElementById("packageFileInput");
  if (dropZone && packageFileInput) {
    dropZone.addEventListener("click", () => packageFileInput.click());

    dropZone.addEventListener("dragover", event => {
      event.preventDefault();
      dropZone.style.borderColor = "var(--accent)";
      dropZone.style.background = "rgba(110, 231, 183, 0.06)";
      dropZone.textContent = "Release to import";
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "";
      dropZone.style.background = "";
      dropZone.textContent = "Drop files here or click to select";
    });

    dropZone.addEventListener("drop", async event => {
      event.preventDefault();
      dropZone.style.borderColor = "";
      dropZone.style.background = "";
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;
      const pkg = getSelectedPackage();
      if (!pkg) {
        alert("No package is selected.");
        return;
      }
      const textarea = document.getElementById("stage4ReturnInput");
      const savedValue = textarea ? textarea.value : "";
      dropZone.textContent = `Importing ${files.length} file(s)...`;
      try {
        const result = await importFilesIntoPackage(pkg, files);
        if (result.error) {
          setWorkspaceStatus(result.error, "danger");
        } else {
          const msg = `Imported ${result.imported} file(s)${result.failed ? `, ${result.failed} failed` : ""}.`;
          setWorkspaceStatus(msg, result.failed ? "warn" : "success");
        }
      } finally {
        dropZone.textContent = "Drop files here or click to select";
        render();
        const restored = document.getElementById("stage4ReturnInput");
        if (restored && savedValue) restored.value = savedValue;
      }
    });

    packageFileInput.addEventListener("change", async () => {
      const files = Array.from(packageFileInput.files || []);
      if (!files.length) return;
      const pkg = getSelectedPackage();
      if (!pkg) {
        alert("No package is selected.");
        packageFileInput.value = "";
        return;
      }
      const textarea = document.getElementById("stage4ReturnInput");
      const savedValue = textarea ? textarea.value : "";
      const result = await importFilesIntoPackage(pkg, files);
      packageFileInput.value = "";
      if (result.error) {
        setWorkspaceStatus(result.error, "danger");
      } else {
        const msg = `Imported ${result.imported} file(s)${result.failed ? `, ${result.failed} failed` : ""}.`;
        setWorkspaceStatus(msg, result.failed ? "warn" : "success");
      }
      render();
      const restored = document.getElementById("stage4ReturnInput");
      if (restored && savedValue) restored.value = savedValue;
    });
  }

  // Lineage graph zoom controls
  const lineageRoot = ui.lineageGraphRoot;
  if (lineageRoot) {
    lineageRoot.addEventListener("click", event => {
      // Zoom controls
      const zoomAction = event.target.closest("[data-lineage-zoom]")?.dataset?.lineageZoom;
      if (zoomAction) {
        const svg = lineageRoot.querySelector(".lineage-svg");
        const label = lineageRoot.querySelector("[data-lineage-zoom-label]");
        const viewport = lineageRoot.querySelector("[data-lineage-viewport]");
        if (!svg) return;
        const current = parseFloat(svg.style.transform?.match(/scale\(([^)]+)\)/)?.[1]) || 1;
        let next;
        if (zoomAction === "in") next = Math.min(2, current + 0.15);
        else if (zoomAction === "out") next = Math.max(0.2, current - 0.15);
        else {
          const vw = viewport?.clientWidth || lineageRoot.clientWidth || 800;
          const svgW = parseFloat(svg.getAttribute("width")) || 800;
          next = Math.min(1, vw / svgW);
        }
        svg.style.transform = `scale(${next})`;
        svg.style.transformOrigin = "0 0";
        if (label) label.textContent = `${Math.round(next * 100)}%`;
        return;
      }

      // Fullscreen toggle
      const fsBtn = event.target.closest("[data-lineage-fullscreen]");
      if (fsBtn) {
        const container = lineageRoot.closest(".section-block") || lineageRoot;
        const isExpanded = container.classList.toggle("lineage-expanded");
        fsBtn.textContent = isExpanded ? "✕" : "⛶";
        fsBtn.title = isExpanded ? "Close expanded view" : "Expand graph";
        if (isExpanded) {
          requestAnimationFrame(() => {
            const svg = lineageRoot.querySelector(".lineage-svg");
            const viewport = lineageRoot.querySelector("[data-lineage-viewport]");
            const label = lineageRoot.querySelector("[data-lineage-zoom-label]");
            if (svg && viewport) {
              const vw = viewport.clientWidth || 800;
              const vh = viewport.clientHeight || 600;
              const svgW = parseFloat(svg.getAttribute("width")) || 800;
              const svgH = parseFloat(svg.getAttribute("height")) || 400;
              const fitScale = Math.min(vw / svgW, vh / svgH, 2);
              svg.style.transform = `scale(${fitScale})`;
              svg.style.transformOrigin = "0 0";
              if (label) label.textContent = `${Math.round(fitScale * 100)}%`;
            }
          });
        }
        return;
      }

      // PNG export
      if (event.target.closest("[data-lineage-export-png]")) {
        const svg = lineageRoot.querySelector(".lineage-svg");
        if (!svg) return;
        const svgW = parseFloat(svg.getAttribute("width")) || 800;
        const svgH = parseFloat(svg.getAttribute("height")) || 400;
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = svgW * scale;
        canvas.height = svgH * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0d1117";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const svgClone = svg.cloneNode(true);
        svgClone.removeAttribute("style");
        svgClone.setAttribute("width", svgW);
        svgClone.setAttribute("height", svgH);
        const svgData = new XMLSerializer().serializeToString(svgClone);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob(pngBlob => {
            if (!pngBlob) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(pngBlob);
            a.download = `lineage_${state.projectName.trim().replace(/\s+/g, "_") || "project"}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
          }, "image/png");
        };
        img.onerror = () => { URL.revokeObjectURL(url); alert("PNG export failed."); };
        img.src = url;
        return;
      }
    });

    lineageRoot.addEventListener("wheel", event => {
      const viewport = lineageRoot.querySelector("[data-lineage-viewport]");
      if (!viewport?.contains(event.target)) return;
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const svg = viewport.querySelector(".lineage-svg");
      const label = lineageRoot.querySelector("[data-lineage-zoom-label]");
      if (!svg) return;
      const current = parseFloat(svg.style.transform?.match(/scale\(([^)]+)\)/)?.[1]) || 1;
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      const next = Math.max(0.2, Math.min(2, current + delta));
      svg.style.transform = `scale(${next})`;
      svg.style.transformOrigin = "0 0";
      if (label) label.textContent = `${Math.round(next * 100)}%`;
    }, { passive: false });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        const container = lineageRoot.closest(".lineage-expanded");
        if (container) {
          container.classList.remove("lineage-expanded");
          const fsBtn = lineageRoot.querySelector("[data-lineage-fullscreen]");
          if (fsBtn) { fsBtn.textContent = "⛶"; fsBtn.title = "Expand graph"; }
        }
      }
    });
  }
}

async function prepareMergeFromCurrentState() {
  if (!hasUsableStagePrompt("stage6")) {
    alert(missingStagePromptMessage("stage6"));
    return;
  }
  const ready = mergeReadyPackages();
  if (!ready.length) {
    alert("You cannot prepare merge yet because no package is currently eligible for Stage 06 handoff.");
    return;
  }
  state.stage6.requestText = buildStage6Request(ready);
  state.stage6.requestPrepared = true;
  state.stage6.requestCopied = false;
  state.stage6.mergeResultText = "";
  state.stage6.mergeSavedAt = "";
  state.stage6.mergeVerdict = "";
  state.stage6.includedPackageKeys = ready.map(pkg => pkg.key);
  const snapshotPath = await writePromptSnapshot("stage6", getStagePromptText("stage6"));
  if (snapshotPath) state.stage6._lastPromptSnapshotPath = snapshotPath;
  saveState("merge request prepared").catch(err => console.error("Persistence failed", err));
  render();
}

function bindIf(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

function commitStage3Result(value) {
  state.stage3.rawOutputText = value;
  state.stage3.savedAt = nowStamp();
  state.stage3.outcome = inferStage3Outcome(value);
  state.stage3.artifacts = parseStage3Artifacts(value);
  const pauseArtifact = state.stage3.artifacts.find(item => item.kind === "pause");

  if (state.stage3.outcome === "pause") {
    const pauseText = pauseArtifact ? pauseArtifact.content : value;
    state.stage3.pauseArtifactText = pauseText;
    state.stage3.pauseQuestionnaireText = extractSectionBlock(pauseText, "Minimal Decision Questionnaire");
    state.stage3.pauseResumeInstruction = extractSectionBlock(pauseText, "Resume Instruction");
    state.stage3.pauseResumeTarget = inferPauseResumeTarget(state.stage3.pauseResumeInstruction || pauseText);
    state.stage3.pauseResponsePrepared = false;
    state.stage3.pauseResponseCopied = false;
    state.stage3.pauseResponsePacketText = "";
    state.stage3.pauseWaitingForUpdatedResult = false;
    clearLateStages();
  } else {
    state.stage3.pauseArtifactText = "";
    state.stage3.pauseQuestionnaireText = "";
    state.stage3.pauseResumeInstruction = "";
    state.stage3.pauseResumeTarget = "";
    state.stage3.pauseResponsePrepared = false;
    state.stage3.pauseResponseCopied = false;
    state.stage3.pauseResponsePacketText = "";
    state.stage3.pauseWaitingForUpdatedResult = false;
    syncPackagesFromStage3();
    state.stage6 = createDefaultState().stage6;
  }
  saveState("stage 3 result saved").catch(err => console.error("Persistence failed", err));
  render();
}

function savePauseReturn(value) {
  const looksLikeStage3 = Boolean(inferStage3Outcome(value));
  if (/Progression Status\s*:/i.test(value)) {
    state.stage2.artifactText = value;
    state.stage2.savedAt = nowStamp();
    state.stage2.readinessStatus = parseReadinessStatus(value);
    state.stage2.progressionStatus = parseProgressionStatus(value);
    state.stage2.requestPrepared = false;
    state.stage2.requestCopied = false;
    state.stage2.requestText = "";
    state.stage2.retryRequestPrepared = false;
    state.stage2.retryRequestCopied = false;
    state.stage2.retryRequestText = "";
    state.stage3 = createDefaultState().stage3;
    clearLateStages();
  } else if (state.stage3.pauseResumeTarget === "stage1" && !looksLikeStage3) {
    state.stage1.artifactText = value;
    state.stage1.savedAt = nowStamp();
    state.stage2 = createDefaultState().stage2;
    state.stage3 = createDefaultState().stage3;
    clearLateStages();
  } else {
    commitStage3Result(value);
    state.stage3.pauseWaitingForUpdatedResult = false;
  }
  saveState("pause return saved").catch(err => console.error("Persistence failed", err));
  render();
}

async function openAnalyticsDashboard() {
  // Collect data from current state + manifest + audit log
  const pkgs = getPackagesInOrder();
  const arts = manifestArtifactList(state);
  let auditLines = [];
  try {
    const consoleDir = workspaceSubHandles[CONSOLE_DIR];
    if (consoleDir) {
      const handle = await consoleDir.getFileHandle(AUDIT_FILE);
      const file = await handle.getFile();
      const text = await file.text();
      text.split("\n").forEach(line => { try { auditLines.push(JSON.parse(line)); } catch(e){} });
    }
  } catch(e) {}

  // Build timeline + cumulative from audit artifact events
  const artifactSaves = auditLines.filter(e => e.event === "ARTIFACT_SAVED");
  const timeline = [];
  const cumulative = [{ hour: "start", artifacts: 0 }];
  let count = 0;
  if (state.stage1.savedAt) { timeline.push({ time: state.stage1.savedAt, event: "Master Briefing saved", stage: 1 }); cumulative.push({ hour: state.stage1.savedAt.slice(0, 16), artifacts: ++count }); }
  if (state.stage2.savedAt) { timeline.push({ time: state.stage2.savedAt, event: "Architecture Spec saved", stage: 2 }); cumulative.push({ hour: state.stage2.savedAt.slice(0, 16), artifacts: ++count }); }
  if (state.stage3.savedAt) {
    const s3c = (state.stage3.artifacts || []).length;
    count += s3c;
    timeline.push({ time: state.stage3.savedAt, event: `Stage 03 — ${s3c} artifacts`, stage: 3 });
    cumulative.push({ hour: state.stage3.savedAt.slice(0, 16), artifacts: count });
  }
  pkgs.forEach(pkg => {
    const blocked = /^blocked$/i.test(pkg.implementationStatus);
    if (pkg.implementationSavedAt) {
      count++;
      timeline.push({ time: pkg.implementationSavedAt, event: `${pkg.packageId || pkg.key}${blocked ? " — BLOCKED" : " implemented"}`, stage: 4 });
      cumulative.push({ hour: pkg.implementationSavedAt.slice(0, 16), artifacts: count });
    }
    if (pkg.reviewSavedAt) {
      count++;
      timeline.push({ time: pkg.reviewSavedAt, event: `${pkg.packageId || pkg.key} reviewed — ${pkg.reviewDisposition || "?"}`, stage: 5 });
      cumulative.push({ hour: pkg.reviewSavedAt.slice(0, 16), artifacts: count });
    }
  });

  const auditCounts = {};
  auditLines.forEach(e => { const ev = (e.event || "unknown").replace(/_/g, " "); auditCounts[ev] = (auditCounts[ev] || 0) + 1; });
  const auditData = Object.entries(auditCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

  const packageData = pkgs.map(pkg => {
    const blocked = /^blocked$/i.test(pkg.implementationStatus);
    const files = arts.filter(a => a.artifactType === "implementation_file" && a.packageKey === pkg.key && a.status === "current").map(a => a.filename || a.title);
    const maxRev = arts.filter(a => a.artifactType === "implementation_output" && a.packageId === (pkg.packageId || pkg.key)).reduce((max, a) => Math.max(max, a.revision || 1), 0);
    return {
      id: pkg.packageId || pkg.key,
      status: pkg.implementationStatus || (pkg.implementationOutputText?.trim() ? "Complete" : ""),
      disposition: pkg.reviewDisposition || "",
      implAt: pkg.implementationSavedAt || "",
      reviewAt: pkg.reviewSavedAt || "",
      rev: maxRev || (pkg.implementationOutputText?.trim() ? 1 : 0),
      files,
      blocked,
      objective: pkg.objective || ""
    };
  });

  const first = state.stage1.savedAt || "";
  const last = timeline.length ? timeline[timeline.length - 1].time : "";
  let hrs = "?";
  try { hrs = ((new Date(last) - new Date(first)) / 3600000).toFixed(1); } catch(e) {}

  const DATA = JSON.stringify({
    project: { name: state.projectName || "Pipeline Project", stage1SavedAt: state.stage1.savedAt, stage2SavedAt: state.stage2.savedAt, stage3SavedAt: state.stage3.savedAt, stage3Outcome: state.stage3.outcome, lastActivity: last, readinessStatus: state.stage2.readinessStatus, progressionStatus: state.stage2.progressionStatus },
    packages: packageData,
    timeline,
    cumulative,
    audit: auditData,
    totalArtifacts: arts.length,
    totalAuditEvents: auditLines.length,
  });

  // Build the analytics HTML — identical to pipeline_analytics.html but with data pre-injected
  const html = analyticsTemplate(DATA);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function analyticsTemplate(dataJson) {
  const hardened = typeof window.__CHARTJS_INLINE === "string";
  const chartjsTag = hardened
    ? `<script>/* Chart.js 4.4.1 - bundled offline */\n${window.__CHARTJS_INLINE}<\/script>`
    : `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"><\/script>`;
  const fontTag = hardened
    ? `<!-- Hardened: no external font loading. System fonts used. -->`
    : `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">`;
  const cspTag = hardened
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;">`
    : ``;
  const fontFallback = hardened
    ? `--mono:'Consolas','Courier New',monospace;--sans:-apple-system,'Segoe UI',sans-serif`
    : `--mono:'JetBrains Mono',monospace;--sans:'IBM Plex Sans',-apple-system,sans-serif`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${cspTag}
<title>Pipeline Analytics${hardened ? " [HARDENED]" : ""}</title>
${fontTag}
${chartjsTag}
<style>
:root{--bg:#000;--surface:rgba(255,255,255,0.03);--border:rgba(255,255,255,0.06);--text:#e5e5e5;--muted:#737373;--faint:#525252;--ghost:#374151;--accent:#6ee7b7;--green:#4ade80;--yellow:#fbbf24;--red:#ef4444;${fontFallback}}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh}
.c{max-width:980px;margin:0 auto;padding:36px 24px 60px}
.tag{font:700 10px/1 var(--mono);text-transform:uppercase;letter-spacing:3px;color:var(--accent);margin-bottom:10px}
h1{font-size:26px;font-weight:700}.sub{font:400 12px/1 var(--mono);color:var(--muted);margin-top:4px}
.sec{margin-bottom:40px}.st{font:700 10px/1 var(--mono);text-transform:uppercase;letter-spacing:2px;color:var(--accent);border-bottom:1px solid rgba(110,231,183,0.15);padding-bottom:6px;margin-bottom:16px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.stat{padding:16px 20px;background:var(--surface);border-radius:12px;border:1px solid var(--border)}
.sl{font:400 10px/1 var(--mono);text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);margin-bottom:6px}
.sv{font:800 28px/1 var(--mono)}.ss{font-size:11px;color:var(--muted);margin-top:4px}
.cw{background:var(--surface);border-radius:12px;padding:16px}.cn{font-size:11px;color:var(--faint);text-align:center;margin-top:8px}
.pg{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.pt{width:74px;height:58px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;border:1.5px solid var(--ghost);background:var(--surface)}
.pt:hover{transform:translateY(-2px)}.pt.sel{outline:2px solid var(--accent);outline-offset:2px}
.pt .pi{font:800 14px/1 var(--mono)}.pt .pm{font-size:9px;color:var(--muted);margin-top:3px}
.pt.sc{border-color:var(--green);background:rgba(74,222,128,0.06)}.pt.sa{border-color:#86efac;background:rgba(74,222,128,0.12)}
.pt.sp{border-color:var(--yellow);background:rgba(251,191,36,0.06)}
.pt.sb{border-color:var(--red);background:rgba(239,68,68,0.15);animation:bp 2s ease-in-out infinite}.pt.sb .pi{color:var(--red)}
.pt.sn{border-color:var(--ghost);opacity:.5}@keyframes bp{0%,100%{opacity:1}50%{opacity:.5}}
.dp{background:var(--surface);border-radius:12px;padding:20px;border:1px solid var(--border);display:none}
.dp.v{display:block;animation:fi .2s ease}.dt{font:700 16px/1.3 var(--sans);margin-bottom:10px}
.dg{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:12px}.dl{color:var(--muted)}
.dn{margin-top:12px;font-size:11px;color:var(--red);line-height:1.5}
@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.badge{display:inline-block;padding:2px 8px;border-radius:6px;font:700 10px/1.4 var(--mono);letter-spacing:.5px}
.bg{background:rgba(74,222,128,0.15);color:var(--green);border:1px solid rgba(74,222,128,0.3)}
.by{background:rgba(251,191,36,0.15);color:var(--yellow);border:1px solid rgba(251,191,36,0.3)}
.br{background:rgba(239,68,68,0.15);color:var(--red);border:1px solid rgba(239,68,68,0.3)}
.bx{background:rgba(55,65,81,0.3);color:var(--ghost);border:1px solid rgba(55,65,81,0.5)}
.tb{background:var(--surface);border-radius:12px;overflow:hidden}
.th{display:grid;grid-template-columns:52px 1fr 90px 60px 90px;gap:8px;padding:10px 14px;font:400 10px/1 var(--mono);text-transform:uppercase;letter-spacing:1px;color:var(--faint);border-bottom:1px solid rgba(255,255,255,0.05)}
.tr{display:grid;grid-template-columns:52px 1fr 90px 60px 90px;gap:8px;padding:9px 14px;align-items:center;border-bottom:1px solid rgba(255,255,255,0.02);cursor:pointer;transition:background .12s}
.tr:hover{background:rgba(255,255,255,0.03)}.tr.sel{background:rgba(110,231,183,0.06)}
.ri{font:800 13px/1 var(--mono)}.rr{text-align:right;font:400 11px/1 var(--mono);color:var(--muted)}
.tl{position:relative;padding-left:28px}.tl::before{content:'';position:absolute;left:7px;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.06)}
.ti{display:flex;align-items:flex-start;gap:14px;margin-bottom:14px;position:relative}
.td{position:absolute;left:-24px;top:4px;width:10px;height:10px;border-radius:50%}
.tt{font:400 11px/1.4 var(--mono);color:var(--faint);min-width:52px;flex-shrink:0}
.te{font-size:13px}.te.bl{color:var(--red)}
.ft{text-align:center;font:400 10px/1 var(--mono);color:var(--ghost);margin-top:48px}
</style></head><body><div class="c" id="d">
<div style="margin-bottom:44px"><div class="tag">Pipeline Analytics</div><h1 id="pTitle"></h1><div class="sub" id="pSub"></div></div>
<div class="sec"><div class="st">Overview</div><div class="stats" id="sG"></div></div>
<div class="sec"><div class="st">Artifact Growth Over Time</div><div class="cw"><canvas id="gC" height="170"></canvas></div><div class="cn">Artifact accumulation across the pipeline run</div></div>
<div class="sec"><div class="st">Package Status Grid</div><div class="pg" id="pG"></div><div class="dp" id="dP"></div></div>
<div class="sec"><div class="st">Package Detail List</div><div class="tb"><div class="th"><span>ID</span><span>Status</span><span style="text-align:right">Disposition</span><span style="text-align:right">Rev</span><span style="text-align:right">Files</span></div><div id="tB"></div></div></div>
<div class="sec"><div class="st">Audit Event Distribution</div><div class="cw"><canvas id="aC" height="180"></canvas></div></div>
<div class="sec"><div class="st">Activity Timeline</div><div class="tl" id="tL"></div></div>
<div class="ft">Multi-LLM Pipeline v5 · Operator Console Analytics</div>
</div>
<div style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:100">
<button id="xPng" style="background:#6ee7b7;color:#000;border:none;border-radius:10px;padding:10px 16px;font:700 12px/1 var(--mono);cursor:pointer;box-shadow:0 4px 16px rgba(110,231,183,0.3);transition:transform .15s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">${hardened ? "🖨️ Print/PDF" : "📷 PNG"}</button>
<button id="xHtml" style="background:#93c5fd;color:#000;border:none;border-radius:10px;padding:10px 16px;font:700 12px/1 var(--mono);cursor:pointer;box-shadow:0 4px 16px rgba(147,197,253,0.3);transition:transform .15s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">💾 HTML</button>
</div>
<style>@media print{[style*="position:fixed"]{display:none!important}body{background:#000!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
<script>
const DATA=${dataJson};
const esc=s=>{const d=document.createElement("div");d.textContent=s;return d.innerHTML};
const sc=s=>({1:"#93c5fd",2:"#c4b5fd",3:"#6ee7b7",4:"#fca5a5",5:"#86efac",6:"#fcd34d"}[s]||"#525252");
const tc=p=>p.blocked?"sb":p.disposition==="ACCEPT"?"sa":p.status==="Complete"?"sc":p.status==="Partial"?"sp":"sn";
const ml=p=>p.blocked?"BLOCKED":p.disposition==="ACCEPT"?"✓ ACCEPT":p.status||"—";
const fd=s=>{if(!s)return"—";const d=new Date(s);return isNaN(d)?s:d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})};
let sel=null;
function cs(){const p=DATA.packages,i=p.filter(x=>x.status&&x.status!=="Blocked").length,r=p.filter(x=>x.disposition==="ACCEPT").length,b=p.filter(x=>x.blocked).length,n=p.filter(x=>!x.status).length;let h="?";try{h=((new Date(DATA.project.lastActivity)-new Date(DATA.project.stage1SavedAt))/3600000).toFixed(1)}catch(e){}return{t:p.length,i,r,b,n,h}}
function rH(){const s=cs();document.getElementById("pTitle").textContent=DATA.project.name;document.getElementById("pSub").textContent=s.t+" packages · "+DATA.totalArtifacts+" artifacts · "+DATA.totalAuditEvents+" audit events · "+s.h+"h elapsed"}
function rS(){const s=cs();const items=[{l:"Packages",v:s.t,s:"Total"},{l:"Implemented",v:s.i,s:"of "+s.t,a:"#4ade80"},{l:"Reviewed",v:s.r,s:"ACCEPT",a:"#86efac"},{l:"Blocked",v:s.b,s:"Upstream gap",a:"#ef4444"},{l:"Not Started",v:s.n,s:"",a:"#374151"},{l:"Duration",v:s.h+"h",s:"First → last",a:"#93c5fd"}];document.getElementById("sG").innerHTML=items.map(i=>'<div class="stat"><div class="sl">'+esc(i.l)+'</div><div class="sv" style="color:'+(i.a||"#e5e5e5")+'">'+i.v+"</div>"+(i.s?'<div class="ss">'+esc(i.s)+"</div>":"")+"</div>").join("")}
function rG(){new Chart(document.getElementById("gC").getContext("2d"),{type:"line",data:{labels:DATA.cumulative.map(d=>d.hour),datasets:[{data:DATA.cumulative.map(d=>d.artifacts),borderColor:"#6ee7b7",borderWidth:2,backgroundColor:"rgba(110,231,183,0.08)",fill:true,stepped:"after",pointRadius:3,pointBackgroundColor:"#6ee7b7",pointBorderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:"#1a1a1a",borderColor:"#333",borderWidth:1}},scales:{x:{ticks:{color:"#525252",font:{family:"'JetBrains Mono'",size:10}},grid:{display:false}},y:{ticks:{color:"#525252",font:{family:"'JetBrains Mono'",size:10}},grid:{color:"rgba(255,255,255,0.03)"}}}}})}
function rA(){const c=["#6ee7b7","#93c5fd","#c4b5fd","#fbbf24","#fca5a5","#525252"];new Chart(document.getElementById("aC").getContext("2d"),{type:"bar",data:{labels:DATA.audit.map(d=>d.name),datasets:[{data:DATA.audit.map(d=>d.count),backgroundColor:DATA.audit.map((_,i)=>c[i%c.length]),borderRadius:4,barThickness:18}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",plugins:{legend:{display:false}},scales:{x:{ticks:{color:"#525252",font:{family:"'JetBrains Mono'",size:10}},grid:{color:"rgba(255,255,255,0.03)"}},y:{ticks:{color:"#a3a3a3",font:{family:"'JetBrains Mono'",size:11}},grid:{display:false}}}}})}
function rP(){const g=document.getElementById("pG");g.innerHTML=DATA.packages.map(p=>'<div class="pt '+tc(p)+(sel===p.id?" sel":"")+'" data-p="'+esc(p.id)+'"><div class="pi">'+esc(p.id)+'</div><div class="pm">'+esc(ml(p))+"</div></div>").join("");g.querySelectorAll(".pt").forEach(t=>t.addEventListener("click",()=>{sel=sel===t.dataset.p?null:t.dataset.p;rP();rD();rT()}))}
function rD(){const p=document.getElementById("dP"),pkg=DATA.packages.find(x=>x.id===sel);if(!pkg){p.classList.remove("v");return}p.classList.add("v");const b=[];if(pkg.status)b.push('<span class="badge '+(pkg.blocked?"br":pkg.status==="Partial"?"by":"bg")+'">'+esc(pkg.status)+"</span>");if(pkg.disposition)b.push('<span class="badge bg">'+esc(pkg.disposition)+"</span>");if(pkg.blocked)b.push('<span class="badge br">UPSTREAM GAP</span>');p.innerHTML='<div class="dt">'+esc(pkg.id)+" "+b.join(" ")+"</div>"+(pkg.objective?'<div style="font-size:12px;color:#a3a3a3;margin-bottom:12px">'+esc(pkg.objective)+"</div>":"")+'<div class="dg"><div><span class="dl">Status: </span>'+esc(pkg.status||"Not started")+'</div><div><span class="dl">Revision: </span>'+(pkg.rev>0?"r"+pkg.rev:"—")+'</div><div><span class="dl">Implemented: </span>'+fd(pkg.implAt)+'</div><div><span class="dl">Reviewed: </span>'+fd(pkg.reviewAt)+'</div><div><span class="dl">Disposition: </span>'+(pkg.disposition||"—")+'</div><div><span class="dl">Files: </span>'+(pkg.files.length||"—")+"</div></div>"+(pkg.files.length?'<div style="margin-top:10px;font-size:11px">'+pkg.files.map(f=>'<code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-family:var(--mono);font-size:10px">'+esc(f)+"</code>").join(" ")+"</div>":"")+(pkg.blocked?'<div class="dn">Blocked by upstream contract gap. Requires Architecture Spec revision before this package can be implemented.</div>':"")}
function rT(){document.getElementById("tB").innerHTML=DATA.packages.map(p=>{const sb=p.blocked?'<span class="badge br">Blocked</span>':p.status==="Complete"?'<span class="badge bg">Complete</span>':p.status==="Partial"?'<span class="badge by">Partial</span>':'<span class="badge bx">—</span>';const db=p.disposition==="ACCEPT"?'<span class="badge bg">ACCEPT</span>':p.disposition==="REWORK"?'<span class="badge by">REWORK</span>':'<span class="badge bx">—</span>';return'<div class="tr'+(sel===p.id?" sel":"")+'" data-p="'+esc(p.id)+'"><span class="ri"'+(p.blocked?' style="color:var(--red)"':"")+">"+esc(p.id)+"</span><span>"+sb+'</span><span style="text-align:right">'+db+'</span><span class="rr">'+(p.rev>0?"r"+p.rev:"—")+'</span><span class="rr">'+(p.files.length?p.files.length+" file"+(p.files.length>1?"s":""):"—")+"</span></div>"}).join("");document.querySelectorAll(".tr").forEach(r=>r.addEventListener("click",()=>{sel=sel===r.dataset.p?null:r.dataset.p;rP();rD();rT()}))}
function rTL(){document.getElementById("tL").innerHTML=DATA.timeline.map(t=>'<div class="ti"><div class="td" style="background:'+sc(t.stage)+";box-shadow:0 0 6px "+sc(t.stage)+'44"></div><span class="tt">'+esc(t.time.slice(0,16))+'</span><span class="te'+(t.event.includes("BLOCKED")?" bl":"")+'">'+esc(t.event)+"</span></div>").join("")}
rH();rS();rG();rP();rD();rT();rA();rTL();
document.getElementById("xPng").addEventListener("click",async()=>{${hardened
  ? `window.print();`
  : `const{default:h2c}=await import("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm");const el=document.getElementById("d");const c=await h2c(el,{backgroundColor:"#000",scale:2,useCORS:true});const a=document.createElement("a");a.href=c.toDataURL("image/png");a.download="pipeline_analytics_"+(DATA.project.name||"project").replace(/\\\\s+/g,"_")+".png";a.click();`
}});
document.getElementById("xHtml").addEventListener("click",()=>{const a=document.createElement("a");a.href="data:text/html;charset=utf-8,"+encodeURIComponent(document.documentElement.outerHTML);a.download="pipeline_analytics_"+(DATA.project.name||"project").replace(/\\s+/g,"_")+".html";a.click()});
<\/script></body></html>`;
}

function bindEvents() {
  ui.exportBackupBtn.addEventListener("click", exportBackup);
  ui.openAnalyticsBtn.addEventListener("click", openAnalyticsDashboard);
  ui.importBackupBtn.addEventListener("click", () => ui.backupInput.click());
  ui.backupInput.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) importBackupFromFile(file);
    event.target.value = "";
  });
  ui.downloadSummaryBtn.addEventListener("click", downloadAllSavedArtifacts);
  ui.resetBtn.addEventListener("click", async () => {
    if (!confirm("Reset the workspace? Existing artifact files and the audit log will be preserved on disk. The workspace state will be archived.")) return;
    try {
      if (workspaceRootHandle && workspaceSubHandles.archive) {
        const archiveTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
        try {
          const archiveDir = await workspaceSubHandles.archive.getDirectoryHandle(
            `reset_${archiveTimestamp}`, { create: true }
          );
          const consoleDir = workspaceSubHandles[CONSOLE_DIR];
          if (consoleDir) {
            try {
              const stateText = await readTextFile(consoleDir, STATE_FILE);
              await writeTextFile(archiveDir, STATE_FILE, stateText);
            } catch (e) { }
            try {
              const manifestText = await readTextFile(consoleDir, MANIFEST_FILE);
              await writeTextFile(archiveDir, MANIFEST_FILE, manifestText);
            } catch (e) { }
          }
        } catch (e) {
          console.warn("Archive before reset failed", e);
        }
      }

      Object.assign(state, createDefaultState());
      await clearHandleFromIDB();
      workspaceRootHandle = null;
      workspaceSubHandles = {};
      await saveState("workspace reset", {
        auditEvent: "WORKSPACE_RESET",
        message: "Workspace reset to defaults. Previous state archived."
      });
      render();
    } catch (err) {
      console.error("Reset failed", err);
    }
  });
}
