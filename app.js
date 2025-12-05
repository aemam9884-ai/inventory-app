// ====================================================
// ⚠️ غيّر الرابط ده بالرابط بتاعك من Google Apps Script
// ====================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbwbuUXb_jzPtnMifODsY7xEjg4eHjBF1yydXJnDHg_Kfi_d1s19oYee7F052u3q5Oot/exec';

// ====================================================
// متغيرات الباركود
// ====================================================
let codeReader = null;
let barcodeStream = null;
let currentBarcodeTarget = null; // الحقل اللي هيتحط فيه الباركود
let flashEnabled = false;

// ====================================================
// إدارة البيانات المحلية
// ====================================================

function getLocalItems() {
    const data = localStorage.getItem('inventoryItems');
    return data ? JSON.parse(data) : [];
}

function saveLocalItems(items) {
    localStorage.setItem('inventoryItems', JSON.stringify(items));
    updateStats();
}

function getPendingSync() {
    const data = localStorage.getItem('pendingSync');
    return data ? JSON.parse(data) : [];
}

function savePendingSync(items) {
    localStorage.setItem('pendingSync', JSON.stringify(items));
    updatePendingCount();
}

// ====================================================
// واجهة المستخدم
// ====================================================

function showSection(sectionName) {
    // إخفاء كل الأقسام
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // إظهار القسم المطلوب
    document.getElementById(sectionName + '-section').classList.add('active');
    event.target.classList.add('active');
    
    if (sectionName === 'inventory') {
        renderItems();
    }
}

function renderItems() {
    const items = getLocalItems();
    const pending = getPendingSync();
    const container = document.getElementById('itemsList');
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <span>📦</span>
                <p>لا توجد أصناف في المخزون</p>
                <p>اضغط على "إضافة" لإضافة صنف جديد</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = items.map(item => {
        const isPending = pending.some(p => p.id === item.id);
        const qtyClass = item.الكمية === 0 ? 'out-of-stock' : 
                         item.الكمية <= 5 ? 'low-stock' : '';
        const pendingClass = isPending ? 'pending' : '';
        
        return `
            <div class="item-card ${qtyClass} ${pendingClass}" onclick="openEdit('${item.id}')">
                <div class="item-header">
                    <span class="item-name">${item.اسم_الصنف}</span>
                    <span class="item-qty">${item.الكمية} ${item.الوحدة}</span>
                </div>
                <div class="item-details">
                    ${item.الموقع ? `<span>📍 ${item.الموقع}</span>` : ''}
                    ${item.تاريخ_التحديث ? `<span>📅 ${item.تاريخ_التحديث}</span>` : ''}
                    ${isPending ? '<span class="item-badge pending">⏳ في انتظار المزامنة</span>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    const items = getLocalItems();
    document.getElementById('totalItems').textContent = items.length;
    document.getElementById('lowStock').textContent = 
        items.filter(i => i.الكمية <= 5).length;
}

function updatePendingCount() {
    const pending = getPendingSync();
    const el = document.getElementById('pendingCount');
    if (pending.length > 0) {
        el.textContent = `⏳ ${pending.length} في الانتظار`;
    } else {
        el.textContent = '';
    }
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ====================================================
// ماسح الباركود باستخدام ZXing
// ====================================================

function openBarcodeScanner(targetInputId) {
    currentBarcodeTarget = targetInputId;
    
    const modal = document.getElementById('barcodeModal');
    modal.classList.add('active');
    
    document.getElementById('scanResult').textContent = '';
    document.getElementById('manualBarcode').value = '';
    
    startBarcodeScanner();
}

async function startBarcodeScanner() {
    try {
        // إنشاء قارئ الباركود
        codeReader = new ZXing.BrowserMultiFormatReader();
        
        const videoElement = document.getElementById('barcode-video');
        
        // الحصول على قائمة الكاميرات
        const videoInputDevices = await codeReader.listVideoInputDevices();
        
        // اختيار الكاميرا الخلفية لو موجودة
        let selectedDeviceId = null;
        
        for (const device of videoInputDevices) {
            if (device.label.toLowerCase().includes('back') || 
                device.label.toLowerCase().includes('rear') ||
                device.label.toLowerCase().includes('environment')) {
                selectedDeviceId = device.deviceId;
                break;
            }
        }
        
        // لو مافيش كاميرا خلفية، استخدم أول كاميرا
        if (!selectedDeviceId && videoInputDevices.length > 0) {
            selectedDeviceId = videoInputDevices[0].deviceId;
        }
        
        // بدء المسح
        codeReader.decodeFromVideoDevice(selectedDeviceId, 'barcode-video', (result, error) => {
            if (result) {
                handleBarcodeResult(result.getText());
            }
            
            if (error && !(error instanceof ZXing.NotFoundException)) {
                console.log('Scan error:', error);
            }
        });
        
        console.log('Scanner started');
        
    } catch (error) {
        console.error('Error starting scanner:', error);
        document.getElementById('scanResult').innerHTML = `
            <span style="color: #ef4444;">❌ خطأ في تشغيل الكاميرا</span><br>
            <small style="color: #9ca3af;">تأكد من السماح بالوصول للكاميرا</small>
        `;
    }
}

function handleBarcodeResult(code) {
    if (!code) return;
    
    console.log('Barcode detected:', code);
    
    // اهتزاز للتنبيه
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
    
    // إغلاق الماسح
    closeBarcodeScanner();
    
    // وضع الكود في الحقل المستهدف
    if (currentBarcodeTarget) {
        const input = document.getElementById(currentBarcodeTarget);
        if (input) {
            input.value = code;
            input.focus();
        }
    }
    
    showToast('✅ تم مسح الباركود: ' + code, 'success');
}

function closeBarcodeScanner() {
    // إيقاف القارئ
    if (codeReader) {
        codeReader.reset();
        codeReader = null;
    }
    
    // إغلاق المودال
    const modal = document.getElementById('barcodeModal');
    modal.classList.remove('active');
    
    // إيقاف الفلاش
    flashEnabled = false;
    
    currentBarcodeTarget = null;
}

function submitManualBarcode() {
    const code = document.getElementById('manualBarcode').value.trim();
    if (code) {
        handleBarcodeResult(code);
    } else {
        showToast('⚠️ أدخل رقم الباركود', 'error');
    }
}

async function toggleFlash() {
    try {
        const video = document.getElementById('barcode-video');
        const stream = video.srcObject;
        
        if (stream) {
            const track = stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                flashEnabled = !flashEnabled;
                await track.applyConstraints({
                    advanced: [{ torch: flashEnabled }]
                });
                showToast(flashEnabled ? '💡 الفلاش مفعّل' : '💡 الفلاش متوقف');
            } else {
                showToast('⚠️ الفلاش غير متاح', 'error');
            }
        }
    } catch (error) {
        console.error('Flash error:', error);
        showToast('⚠️ لا يمكن تشغيل الفلاش', 'error');
    }
}

// ====================================================
// إضافة صنف
// ====================================================

function addItem(e) {
    e.preventDefault();
    
    const name = document.getElementById('itemName').value.trim();
    const qty = document.getElementById('itemQty').value;
    
    if (!name || qty === '') {
        showToast('⚠️ أدخل اسم الصنف والكمية', 'error');
        return;
    }
    
    const newItem = {
        id: Date.now().toString(),
        اسم_الصنف: name,
        الكمية: parseInt(qty),
        الوحدة: document.getElementById('itemUnit').value,
        الموقع: document.getElementById('itemLocation').value.trim(),
        ملاحظات: document.getElementById('itemNotes').value.trim(),
        تاريخ_التحديث: new Date().toLocaleDateString('ar-EG')
    };
    
    // حفظ محلياً
    const items = getLocalItems();
    items.unshift(newItem);
    saveLocalItems(items);
    
    // إضافة للمزامنة
    const pending = getPendingSync();
    pending.push({...newItem, action: 'add'});
    savePendingSync(pending);
    
    // مسح الفورم
    document.getElementById('addForm').reset();
    
    showToast('✅ تم إضافة الصنف', 'success');
    
    // محاولة المزامنة لو فيه نت
    if (navigator.onLine) {
        syncWithServer();
    }
    
    // الانتقال لقائمة المخزون
    document.querySelector('.tab').click();
}

// ====================================================
// التعديل والحذف
// ====================================================

function openEdit(id) {
    const items = getLocalItems();
    const item = items.find(i => i.id === id);
    
    if (!item) return;
    
    document.getElementById('editId').value = item.id;
    document.getElementById('editName').value = item.اسم_الصنف;
    document.getElementById('editQty').value = item.الكمية;
    document.getElementById('editUnit').value = item.الوحدة;
    document.getElementById('editLocation').value = item.الموقع || '';
    document.getElementById('editNotes').value = item.ملاحظات || '';
    
    document.getElementById('editModal').classList.add('active');
}

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
}

function saveEdit(e) {
    e.preventDefault();
    
    const id = document.getElementById('editId').value;
    const updatedItem = {
        id: id,
        اسم_الصنف: document.getElementById('editName').value.trim(),
        الكمية: parseInt(document.getElementById('editQty').value),
        الوحدة: document.getElementById('editUnit').value,
        الموقع: document.getElementById('editLocation').value.trim(),
        ملاحظات: document.getElementById('editNotes').value.trim(),
        تاريخ_التحديث: new Date().toLocaleDateString('ar-EG')
    };
    
    // تحديث محلياً
    let items = getLocalItems();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
        items[index] = updatedItem;
        saveLocalItems(items);
    }
    
    // إضافة للمزامنة
    const pending = getPendingSync();
    const pendingIndex = pending.findIndex(p => p.id === id);
    if (pendingIndex !== -1) {
        pending[pendingIndex] = {...updatedItem, action: 'update'};
    } else {
        pending.push({...updatedItem, action: 'update'});
    }
    savePendingSync(pending);
    
    closeModal();
    renderItems();
    showToast('✅ تم حفظ التعديلات', 'success');
    
    if (navigator.onLine) {
        syncWithServer();
    }
}

function deleteItem() {
    const id = document.getElementById('editId').value;
    
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
    
    // حذف محلياً
    let items = getLocalItems();
    items = items.filter(i => i.id !== id);
    saveLocalItems(items);
    
    // إضافة للمزامنة
    const pending = getPendingSync();
    pending.push({id: id, action: 'delete'});
    savePendingSync(pending);
    
    closeModal();
    renderItems();
    showToast('🗑️ تم حذف الصنف', 'success');
    
    if (navigator.onLine) {
        syncWithServer();
    }
}

// ====================================================
// البحث
// ====================================================

function searchItems() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const items = getLocalItems();
    const container = document.getElementById('searchResults');
    
    if (!query) {
        container.innerHTML = '<div class="empty-message"><span>🔍</span><p>اكتب اسم الصنف للبحث</p></div>';
        return;
    }
    
    const results = items.filter(item => 
        item.اسم_الصنف.toLowerCase().includes(query) ||
        (item.الموقع && item.الموقع.toLowerCase().includes(query))
    );
    
    if (results.length === 0) {
        container.innerHTML = '<div class="empty-message"><span>😕</span><p>لا توجد نتائج</p></div>';
        return;
    }
    
    container.innerHTML = results.map(item => `
        <div class="item-card" onclick="openEdit('${item.id}')">
            <div class="item-header">
                <span class="item-name">${item.اسم_الصنف}</span>
                <span class="item-qty">${item.الكمية} ${item.الوحدة}</span>
            </div>
            <div class="item-details">
                ${item.الموقع ? `<span>📍 ${item.الموقع}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// ====================================================
// المزامنة مع السيرفر
// ====================================================

async function syncWithServer() {
    const pending = getPendingSync();
    
    if (pending.length === 0) {
        showToast('✅ كل البيانات متزامنة');
        return;
    }
    
    if (!navigator.onLine) {
        showToast('⚠️ لا يوجد اتصال بالإنترنت', 'error');
        return;
    }
    
    const syncBtn = document.getElementById('syncBtn');
    syncBtn.innerHTML = '<span class="loading">🔄</span>';
    syncBtn.disabled = true;
    
    try {
        // فصل العمليات حسب النوع
        const toAdd = pending.filter(p => p.action === 'add');
        const toUpdate = pending.filter(p => p.action === 'update');
        const toDelete = pending.filter(p => p.action === 'delete');
        
        // تنفيذ الحذف
        for (const item of toDelete) {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: item.id })
            });
        }
        
        // تنفيذ الإضافة والتعديل
        const itemsToSync = [...toAdd, ...toUpdate].map(item => ({
            id: item.id,
            اسم_الصنف: item.اسم_الصنف,
            الكمية: item.الكمية,
            الوحدة: item.الوحدة,
            الموقع: item.الموقع,
            ملاحظات: item.ملاحظات
        }));
        
        if (itemsToSync.length > 0) {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync', items: itemsToSync })
            });
        }
        
        // مسح قائمة الانتظار
        savePendingSync([]);
        
        // تحديث وقت آخر مزامنة
        const now = new Date().toLocaleString('ar-EG');
        document.getElementById('lastUpdate').textContent = 'آخر تحديث: ' + now;
        localStorage.setItem('lastSync', now);
        
        renderItems();
        showToast('✅ تمت المزامنة بنجاح', 'success');
        
    } catch (error) {
        console.error('Sync error:', error);
        showToast('❌ خطأ في المزامنة', 'error');
    }
    
    syncBtn.innerHTML = '🔄';
    syncBtn.disabled = false;
}

async function loadFromServer() {
    if (!navigator.onLine) {
        showToast('⚠️ لا يوجد اتصال بالإنترنت', 'error');
        return;
    }
    
    showToast('⏳ جاري التحميل...');
    
    try {
        const response = await fetch(API_URL);
        const result = await response.json();
        
        if (result.success) {
            saveLocalItems(result.data);
            savePendingSync([]);
            renderItems();
            
            const now = new Date().toLocaleString('ar-EG');
            document.getElementById('lastUpdate').textContent = 'آخر تحديث: ' + now;
            localStorage.setItem('lastSync', now);
            
            showToast('✅ تم تحميل البيانات', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Load error:', error);
        showToast('❌ خطأ في تحميل البيانات', 'error');
    }
}

// ====================================================
// حالة الاتصال
// ====================================================

function updateConnectionStatus() {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('connectionStatus');
    
    if (navigator.onLine) {
        statusBar.classList.remove('offline');
        statusText.textContent = '🟢 متصل';
    } else {
        statusBar.classList.add('offline');
        statusText.textContent = '🔴 غير متصل - وضع Offline';
    }
}

window.addEventListener('online', () => {
    updateConnectionStatus();
    showToast('🟢 تم الاتصال بالإنترنت', 'success');
    // مزامنة تلقائية
    const pending = getPendingSync();
    if (pending.length > 0) {
        setTimeout(syncWithServer, 1000);
    }
});

window.addEventListener('offline', () => {
    updateConnectionStatus();
    showToast('🔴 انقطع الاتصال - الشغل متاح Offline', 'error');
});

// ====================================================
// تشغيل التطبيق
// ====================================================

document.addEventListener('DOMContentLoaded', () => {
    updateConnectionStatus();
    updatePendingCount();
    updateStats();
    renderItems();
    
    // عرض آخر وقت مزامنة
    const lastSync = localStorage.getItem('lastSync');
    if (lastSync) {
        document.getElementById('lastUpdate').textContent = 'آخر تحديث: ' + lastSync;
    }
    
    // تسجيل Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('SW registered'))
            .catch(err => console.log('SW failed:', err));
    }
});

// إغلاق المودال بالضغط برا
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeModal();
    }
});

// إغلاق مودال الباركود بالضغط برا
document.getElementById('barcodeModal').addEventListener('click', (e) => {
    if (e.target.id === 'barcodeModal') {
        closeBarcodeScanner();
    }
});