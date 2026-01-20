<?php include 'connect.php'; ?>
<link rel="stylesheet" href="style.css">

<div class="card">
<h2>📦 Estoque</h2>
<a href="add.php">➕ Adicionar Produto</a>
<br><br>

<table class="table">
<tr>
    <th>Produto</th>
    <th>Qtd</th>
    <th>Preço</th>
    <th>Ações</th>
</tr>

<?php
$sql = $pdo->query("SELECT * FROM produtos ORDER BY nome ASC");
foreach ($sql as $p):
?>
<tr class="<?= $p['estoque'] <= 5 ? 'low' : '' ?>">
    <td><?= $p['nome'] ?></td>
    <td><?= $p['estoque'] ?></td>
    <td>R$ <?= number_format($p['preco'],2,',','.') ?></td>
    <td><a href="estoque.php?id=<?= $p['id'] ?>">Gerenciar</a></td>
</tr>
<?php endforeach; ?>
</table>
</div>
