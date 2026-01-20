<?php
include 'connect.php';

$id = $_GET['id'];

// Buscar produto
$sql = $pdo->prepare("SELECT * FROM produtos WHERE id = ?");
$sql->execute([$id]);
$p = $sql->fetch(PDO::FETCH_ASSOC);
?>

<link rel="stylesheet" href="style.css">

<style>
.card {
    background: #fff;
    padding: 25px;
    margin-top: 15px;
    border-radius: 10px;
    box-shadow: 0 0 10px #0002;
}
input, button {
    padding: 10px;
    width: 100%;
    margin-top: 6px;
    border-radius: 6px;
    border: 1px solid #ccc;
}
.btn-voltar {
    padding: 8px 14px;
    background: #ddd;
    border-radius: 6px;
    text-decoration: none;
    color: #333;
}
button {
    background: #007bff;
    border: none;
    color: white;
    cursor: pointer;
}
button:hover {
    background: #0056b3;
}
.titulo {
    font-size: 22px;
    margin-bottom: 8px;
}
.subtitulo {
    margin-top: 25px;
    font-size: 18px;
}
</style>

<a href="javascript:history.back()" class="btn-voltar">⬅ Voltar</a>

<div class="card">
    <h2 class="titulo">🔧 Gerenciar Estoque</h2>

    <p><strong>Produto:</strong> <?= $p['nome'] ?></p>
    <p><strong>Estoque atual:</strong> <?= $p['estoque'] ?> unidades</p>

    <h3 class="subtitulo">📥 Atualizar Estoque Manualmente</h3>

    <form method="post">
        <label>Nova quantidade:</label>
        <input type="number" name="estoque" value="<?= $p['estoque'] ?>" required>
        <button type="submit" name="salvar">💾 Salvar</button>
    </form>

    <h3 class="subtitulo">📤 Saída de Ingredientes</h3>

    <form method="post">
        <label>Quantidade a retirar:</label>
        <input type="number" name="saida" min="1" placeholder="Ex: 2" required>
        <button type="submit" name="retirar">➖ Registrar Saída</button>
    </form>

</div>

<?php

// Atualizar estoque manual
if (isset($_POST['salvar'])) {
    $novo = $_POST['estoque'];
    $up = $pdo->prepare("UPDATE produtos SET estoque = ? WHERE id = ?");
    $up->execute([$novo, $id]);

    echo "<script>alert('Estoque atualizado!'); location.href='index.php';</script>";
}

// Registrar saída de ingredientes
if (isset($_POST['retirar'])) {
    $saida = intval($_POST['saida']);

    if ($saida > $p['estoque']) {
        echo "<script>alert('Erro: valor maior que o estoque!');</script>";
        exit;
    }

    $novoEstoque = $p['estoque'] - $saida;

    $up = $pdo->prepare("UPDATE produtos SET estoque = ? WHERE id = ?");
    $up->execute([$novoEstoque, $id]);

    echo "<script>alert('Saída registrada! Estoque atualizado.'); location.href='estoque.php?id=$id';</script>";
}
?>
