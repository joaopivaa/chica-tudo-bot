<?php include 'connect.php'; ?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Estoque • Chica Tudo</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<div class="container">

    <header class="topo">
        <h1>🍔 Chica Tudo</h1>
    </header>

    <div class="card">
        <div class="card-top">
            <h2>📦 Produtos em Estoque</h2>
            <a href="add.php" class="btn-add">➕ Novo Produto</a>
        </div>

        <table class="table">
    <thead>
        <tr>
            <th>Produto</th>
            <th>Descrição</th>
            <th>Qtd</th>
            <th>Preço</th>
            <th>Ações</th>
        </tr>
    </thead>
    <tbody>
        <?php
        $sql = $pdo->query("SELECT * FROM produtos ORDER BY nome ASC");
        foreach ($sql as $p):
        ?>
        <tr class="<?= $p['estoque'] <= 5 ? 'low' : '' ?>">
            <td class="produto"><?= htmlspecialchars($p['nome']) ?></td>

            <td class="descricao">
                <?= nl2br(htmlspecialchars($p['descricao'])) ?>
            </td>

            <td class="qtd"><?= $p['estoque'] ?></td>

            <td class="preco">
                R$ <?= number_format($p['preco'], 2, ',', '.') ?>
            </td>

            <td class="acoes">
                <a href="estoque.php?id=<?= $p['id'] ?>" class="btn-gerenciar">Gerenciar</a>
                <a href="excluir.php?id=<?= $p['id'] ?>"
                   class="btn-excluir"
                   onclick="return confirm('Deseja excluir este produto?');">
                   Excluir
                </a>
            </td>
        </tr>
        <?php endforeach; ?>
    </tbody>
</table>

    </div>
<center>
    <footer class="footer">
        Sistema de Estoque • Chica Lanchonete © <?= date('Y') ?>
    </footer>
            </center>

</div>

</body>
</html>
