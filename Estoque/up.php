<?php
include 'connect.php';

$id = $_GET["id"];
$tipo = $_GET["t"];
$qtd  = intval($_POST["qtd"]);

$stmt = $pdo->prepare("SELECT estoque FROM produtos WHERE id=?");
$stmt->execute([$id]);
$atual = $stmt->fetchColumn();

if ($tipo == "add") {
    $novo = $atual + $qtd;
} else {
    $novo = $atual - $qtd;
    if ($novo < 0) $novo = 0;
}

$update = $pdo->prepare("UPDATE produtos SET estoque=? WHERE id=?");
$update->execute([$novo, $id]);

header("Location: index.php");
exit;
?>
