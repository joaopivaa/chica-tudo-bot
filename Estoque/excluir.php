<?php
include 'connect.php';

if (!isset($_GET['id'])) {
    die("ID não informado");
}

$id = intval($_GET['id']);

$stmt = $pdo->prepare("DELETE FROM produtos WHERE id = ?");
if ($stmt->execute([$id])) {
    header("Location: index.php");
    exit;
} else {
    echo "Erro ao excluir produto";
}
