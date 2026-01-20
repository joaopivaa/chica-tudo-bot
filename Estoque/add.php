<?php include 'connect.php'; ?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Novo Produto</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<div class="container">

<div class="card">
    <h2>➕ Cadastrar Produto</h2>

    <?php
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $stmt = $pdo->prepare("
            INSERT INTO produtos (nome, descricao, categoria, preco, estoque)
            VALUES (?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $_POST['nome'],
            $_POST['descricao'],
            $_POST['categoria'],
            $_POST['preco'],
            $_POST['estoque']
        ]);

        header("Location: index.php");
        exit;
    }
    ?>

    <form method="POST">
        <input name="nome" placeholder="Nome do produto" required>

        <textarea name="descricao" placeholder="Descrição do produto" rows="3"></textarea>

        <input name="categoria" placeholder="Categoria (Ex: Lanche, Bebida)">

        <input name="preco" type="number" step="0.01" placeholder="Preço" required>

        <input name="estoque" type="number" placeholder="Quantidade em estoque" required>

        <button type="submit">Cadastrar</button>
    </form>
</div>

</div>

</body>
</html>
