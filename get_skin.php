<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$cache_dir = __DIR__ . '/skin_cache/';
if (!is_dir($cache_dir)) {
    mkdir($cache_dir, 0755, true);
}
$cache_time = 3600; // Кэш на 1 час

$username = isset($_GET['username']) ? trim($_GET['username']) : 'steve';

// 1. Валидация никнейма (только буквы, цифры и подчеркивания, от 3 до 16 символов)
if (!preg_match('/^[a-zA-Z0-9_]{3,16}$/', $username)) {
    echo json_encode(['error' => 'Неверный формат никнейма.']);
    exit;
}

$cache_file = $cache_dir . strtolower($username) . '.json';

// Проверяем серверный кэш
if (file_exists($cache_file) && (time() - filemtime($cache_file) < $cache_time)) {
    echo file_get_contents($cache_file);
    exit;
}

// 2. Получаем UUID игрока
$uuid_url = "https://api.mojang.com/users/profiles/minecraft/" . $username;
$uuid_response = @file_get_contents($uuid_url);

if (!$uuid_response) {
    echo json_encode(['error' => 'Игрок не найден.']);
    exit;
}

$uuid_data = json_decode($uuid_response, true);
if (!isset($uuid_data['id'])) {
    echo json_encode(['error' => 'Не удалось получить UUID.']);
    exit;
}

$uuid = $uuid_data['id'];

// 3. Получаем профиль с текстурами
$profile_url = "https://sessionserver.mojang.com/session/minecraft/profile/" . $uuid;
$profile_response = @file_get_contents($profile_url);

if (!$profile_response) {
    echo json_encode(['error' => 'Не удалось получить профиль игрока.']);
    exit;
}

$profile_data = json_decode($profile_response, true);
$skin_url = "";

if (isset($profile_data['properties'])) {
    foreach ($profile_data['properties'] as $property) {
        if ($property['name'] === 'textures') {
            $textures_encoded = $property['value'];
            $textures_decoded = json_decode(base64_decode($textures_encoded), true);
            if (isset($textures_decoded['textures']['SKIN']['url'])) {
                $skin_url = $textures_decoded['textures']['SKIN']['url'];
            }
            break;
        }
    }
}

// Если у игрока нет кастомного скина, отдаем дефолтный URL Стива
if (empty($skin_url)) {
    $skin_url = "http://assets.mojang.com/textures/2e59c0b11f0e4c69b754d424209c30222473c0cc6af3a669cfbde9efc5690"; 
}

$response = [
    'username' => $username,
    'uuid' => $uuid,
    'skin_url' => $skin_url
];

$json_response = json_encode($response);
file_put_contents($cache_file, $json_response);

echo $json_response;