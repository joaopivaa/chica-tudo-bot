<?php include 'connect.php'; ?>

<a href="javascript:history.back()" class="btn" 
   style="background:#eee;padding:8px 15px;border-radius:6px;text-decoration:none;">
   ⬅ Voltar
</a>

<?php
if(isset($_POST["nome"])) {
    $stmt = $pdo->prepare("INSERT INTO produtos (nome, descricao, quantidade, preco) VALUES (?, ?, ?, ?)");
    $stmt->execute([
        $_POST["nome"],
        $_POST["descricao"],
        $_POST["quantidade"],
        $_POST["preco"]
    ]);

    header("Location: index.php");
    exit;
}
?>

<link rel="stylesheet" href="style.css">

<div class="card">
<h2>➕ Adicionar Produto</h2>

<form method="POST">
    <input name="nome" placeholder="Nome do produto" required>
    <textarea name="descricao" placeholder="Descrição"></textarea>
    <input name="quantidade" type="number" placeholder="Quantidade inicial" required>
    <input name="preco" type="number" step="0.01" placeholder="Preço">
    <button>Cadastrar</button>
</form>
</div>
