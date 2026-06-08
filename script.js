// НАСТРОЙКА CORS: 
// true — использовать встроенный прокси-обходчик для работы напрямую из браузера.
// false — отправлять прямые запросы к Mojang (сработает только на сервере с настроенным CORS-проксированием).
const USE_PROXY = true;
const PROXY_URL = "https://api.allorigins.win/raw?url=";

// Стандартный скин Стива (Base64), чтобы проект запускался корректно без внешних зависимостей при старте
const DEFAULT_STEVE_SKIN = "https://textures.minecraft.net/texture/1a556685123d9238342cfed2e00585e13aa4df296e819bfa7fae019318a6e8e8";

// Элементы DOM
const usernameInput = document.getElementById("username-input");
const searchBtn = document.getElementById("search-btn");
const downloadBtn = document.getElementById("download-btn");
const statusMessage = document.getElementById("status-message");

let skinViewer;
let currentSkinUrl = DEFAULT_STEVE_SKIN;
let currentUsername = "Steve";

// Инициализация 3D просмотрщика при загрузке страницы
function initSkinViewer() {
    skinViewer = new skinview3d.SkinViewer({
        canvas: document.getElementById("skin-viewer"),
        width: 300,
        height: 350,
        skin: DEFAULT_STEVE_SKIN
    });

    // Настройка анимации и управления
    skinViewer.autoRotate = true;
    skinViewer.autoRotateSpeed = 0.5;
    
    // Включение OrbitControls (вращение мышкой, зум)
    skinViewer.controls = skinview3d.createOrbitControls(skinViewer);
    skinViewer.controls.enableZoom = true;
    
    // Корректировка под адаптивность при ресайзе
    window.addEventListener('resize', () => {
        const wrapper = document.querySelector('.viewer-wrapper');
        skinViewer.width = wrapper.clientWidth - 20;
        skinViewer.height = wrapper.clientHeight - 20;
    });
}

// Показ кастомных статусных сообщений
function showStatus(text, type = "loading") {
    statusMessage.textContent = text;
    statusMessage.className = `mc-status ${type}`;
}

function hideStatus() {
    statusMessage.className = "mc-status hidden";
}

// Помощник для сборки URL с учётом прокси
function buildUrl(targetUrl) {
    return USE_PROXY ? `${PROXY_URL}${encodeURIComponent(targetUrl)}` : targetUrl;
}

// Главная логика запросов к Mojang API
async function fetchSkin() {
    const username = usernameInput.value.trim();
    if (!username) {
        showStatus("Введите никнейм!", "error");
        return;
    }

    // Блокируем интерфейс на время загрузки
    searchBtn.disabled = true;
    downloadBtn.disabled = true;
    showStatus("Загрузка...", "loading");

    try {
        // Шаг 1: Получаем UUID по никнейму игрока
        const profileUrl = buildUrl(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        const profileResponse = await fetch(profileUrl);

        if (profileResponse.status === 204 || profileResponse.status === 404) {
            throw new Error("Игрок не найден, проверьте никнейм");
        }
        if (!profileResponse.ok) {
            throw new Error("Ошибка сервера Mojang API");
        }

        const profileData = await profileResponse.json();
        const uuid = profileData.id;

        // Шаг 2: Получаем сессию и текстуры по UUID
        const sessionUrl = buildUrl(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}?unsigned=false`);
        const sessionResponse = await fetch(sessionUrl);
        
        if (!sessionResponse.ok) {
            throw new Error("Не удалось получить свойства профиля");
        }

        const sessionData = await sessionResponse.json();
        
        // Извлекаем свойство "textures"
        const texturesProperty = sessionData.properties?.find(prop => prop.name === "textures");
        if (!texturesProperty) {
            throw new Error("У этого игрока нет кастомных текстур");
        }

        // Шаг 3: Декодируем Base64 строку из текстур
        const decodedTexturesJson = JSON.parse(atob(texturesProperty.value));
        const skinUrl = decodedTexturesJson.textures?.SKIN?.url;

        if (!skinUrl) {
            throw new Error("Файл скина не найден в профиле");
        }

        // Шаг 4: Обновляем модель и готовим скачивание
        currentSkinUrl = skinUrl;
        currentUsername = username;

        // Загружаем скин в skinview3d плеер
        await skinViewer.loadSkin(currentSkinUrl);
        
        // Проверяем модель (Alex с тонкими руками или Steve со стандартными)
        const isSlim = decodedTexturesJson.textures?.SKIN?.metadata?.model === "slim";
        skinViewer.playerObject.skin.model = isSlim ? "slim" : "default";

        hideStatus();
        downloadBtn.disabled = false;
        downloadBtn.classList.remove("disabled");

    } catch (error) {
        console.error(error);
        showStatus(error.message || "Произошла неизвестная ошибка", "error");
    } finally {
        searchBtn.disabled = false;
    }
}

// Логика скачивания PNG файла
async function downloadSkinImage() {
    try {
        // Запрашиваем саму картинку. Текстурный сервер Mojang отлично поддерживает CORS
        const response = await fetch(currentSkinUrl);
        if (!response.ok) throw new Error("Не удалось скачать файл изображения");
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Создаем временную ссылку для триггера скачивания
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `${currentUsername}_skin.png`;
        
        document.body.appendChild(link);
        link.click();
        
        // Подчищаем за собой память
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error(error);
        showStatus("Ошибка при скачивании файла", "error");
    }
}

// Инициализация обработчиков событий
searchBtn.addEventListener("click", fetchSkin);
usernameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") fetchSkin();
});
downloadBtn.addEventListener("click", downloadSkinImage);

// Запуск плеера при старте
initSkinViewer();