#requires -Version 5.1
<#
  extract-mechanics.ps1

  Deriva a camada de mecanica do Fibula a partir de um servidor Tibia open source
  (The Forgotten Server, GPLv2). Le os dados de combate, vocacoes, itens, monstros
  e spells e emite JSON neutro em data/mechanics/.

  Postura de conteudo: os arquivos versionados carregam SOMENTE numeros, formulas e
  descritores mecanicos. Nomes proprios (monstros, itens, spells) ficam de fora e,
  se -WithNames for passado, vao apenas para data/mechanics/.local/ (nao versionado),
  como referencia de projeto.

  Uso:
    powershell -ExecutionPolicy Bypass -File tools/extract-mechanics.ps1 -WithNames
#>
[CmdletBinding()]
param(
  [string]$TfsPath = (Join-Path $env:USERPROFILE 'dev\forgottenserver'),
  [string]$OutDir,
  [switch]$WithNames
)

$ErrorActionPreference = 'Stop'

if (-not $OutDir) {
  $root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
  $OutDir = Join-Path $root '..\data\mechanics'
}

if (-not (Test-Path (Join-Path $TfsPath 'data\XML\vocations.xml'))) {
  throw "Nao encontrei um servidor TFS em '$TfsPath'. Passe -TfsPath apontando para o clone."
}

$OutDir = [System.IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Force $OutDir | Out-Null
$LocalDir = Join-Path $OutDir '.local'
if ($WithNames) { New-Item -ItemType Directory -Force $LocalDir | Out-Null }

function Write-Json {
  param([Parameter(Mandatory)]$Data, [Parameter(Mandatory)][string]$Path, [switch]$Compress)
  $json = if ($Compress) { $Data | ConvertTo-Json -Depth 12 -Compress }
          else           { $Data | ConvertTo-Json -Depth 12 }
  [System.IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
  $kb = [math]::Round((Get-Item $Path).Length / 1KB, 1)
  Write-Host ("  -> {0,-16} {1,8} KB" -f (Split-Path $Path -Leaf), $kb)
}

# Os dados de origem usam ponto decimal. Em locale pt-BR o TryParse padrao leria
# "4.0" como 40, entao todo parse aqui e feito em cultura invariante.
$script:Inv      = [System.Globalization.CultureInfo]::InvariantCulture
$script:NumStyle = [System.Globalization.NumberStyles]::Float

function Get-Num {
  param($v, $default = 0)
  if ($null -eq $v -or $v -eq '') { return $default }
  $out = 0.0
  if ([double]::TryParse([string]$v, $script:NumStyle, $script:Inv, [ref]$out)) { return $out }
  return $default
}

$stamp = (Get-Item (Join-Path $TfsPath 'data\XML\vocations.xml')).LastWriteTimeUtc.ToString('yyyy-MM-dd')
$provenance = [ordered]@{
  derivedFrom    = 'The Forgotten Server (otland/forgottenserver), GPLv2'
  sourceDataAsOf = $stamp
  contentPolicy  = 'Somente numeros, formulas e descritores mecanicos. Sem nomes, descricoes ou assets de origem.'
  generatedBy    = 'tools/extract-mechanics.ps1'
}

# ---------------------------------------------------------------- 1. COMBATE
Write-Host "`n[1/5] combate (formulas)"

$combat = [ordered]@{
  _meta = $provenance
  weaponDamage = [ordered]@{
    formula       = 'max = round(level/5 + ((skill/4 + 1) * (attack/3) * 1.03) / attackFactor)'
    levelDivisor  = 5
    skillDivisor  = 4
    attackDivisor = 3
    constant      = 1.03
    roll          = 'dano = aleatorio em [0, max] com vies para o alto; multiplicado pelo multiplicador de dano da classe'
    unarmed       = [ordered]@{ attackValue = 7; formula = 'mesma, usando a skill de maos livres' }
    source        = 'src/weapons.cpp:123 (getMaxWeaponDamage), :117 (getMaxMeleeDamage)'
  }
  attackFactor = [ordered]@{
    offensive = 1.0
    balanced  = 1.2
    defensive = 2.0
    effect    = 'divide o dano: postura defensiva corta o dano pela metade'
    source    = 'src/player.cpp:409 (getAttackFactor)'
  }
  spellDamage = [ordered]@{
    note     = 'coeficientes por spell em spells.json, no campo formula.family'
    families = [ordered]@{
      levelMagic  = [ordered]@{
        formula = 'min = level/levelDivisor + magicLevel*aMin + bMin ; max = idem com aMax/bMax'
        usedBy  = 'magias de conjurador: escalam com magic level'
      }
      skillAttack = [ordered]@{
        formula = 'min = level/levelDivisor + (skill * attackValue * aMin) + bMin ; max = idem com aMax/bMax'
        usedBy  = 'golpes de arma: escalam com a skill da arma e o ataque do equipamento'
      }
      flat        = [ordered]@{
        formula = 'min/max constantes, sem escala'
        usedBy  = 'magias de treino/iniciante'
      }
      custom      = [ordered]@{
        formula = 'expressao propria preservada em formula.minExpr/maxExpr'
        usedBy  = 'casos especiais (ex. escala por skill de distancia)'
      }
    }
    source = 'data/scripts/spells/attack/*.lua (onGetFormulaValues)'
  }
  elements = [ordered]@{
    scale = 'percent'
    note  = 'positivo = resistencia (reduz o dano nessa porcentagem); negativo = vulnerabilidade'
  }
  lootChance = [ordered]@{ scale = 100000; note = 'chance crua do servidor; p = chance/100000' }
}

$stagesPath = Join-Path $TfsPath 'data\XML\stages.xml'
if (Test-Path $stagesPath) {
  $sx = [xml](Get-Content -Raw -Encoding UTF8 $stagesPath)
  $combat.expStages = @(foreach ($s in $sx.stages.stage) {
    [ordered]@{
      minLevel   = [int](Get-Num $s.minlevel 1)
      maxLevel   = if ($s.maxlevel) { [int](Get-Num $s.maxlevel) } else { $null }
      multiplier = (Get-Num $s.multiplier 1)
    }
  })
}
Write-Json -Data $combat -Path (Join-Path $OutDir 'combat.json')

# ---------------------------------------------------------------- 2. CLASSES
Write-Host "[2/5] classes (vocacoes)"

$skillNames = @('fist','club','sword','axe','distance','shielding','fishing')
$vx = [xml](Get-Content -Raw -Encoding UTF8 (Join-Path $TfsPath 'data\XML\vocations.xml'))

$classes = @()
$classNames = @{}
foreach ($v in $vx.vocations.vocation) {
  $id      = [int](Get-Num $v.id)
  $gainHp  = [int](Get-Num $v.gainhp)
  $gainMp  = [int](Get-Num $v.gainmana)
  $gainCap = [int](Get-Num $v.gaincap)
  $shield  = ((Get-Num $v.magicshield) -eq 1)

  # arquetipo derivado dos numeros, nao do nome de origem
  $archetype =
    if     ($gainMp -ge 25 -and $shield)         { 'caster' }
    elseif ($gainHp -ge 15 -and $gainCap -ge 25) { 'tank' }
    elseif ($gainMp -ge 10 -and $gainHp -ge 10)  { 'hybrid' }
    elseif ($gainHp -eq $gainMp)                 { 'neutral' }
    else                                         { 'unclassified' }

  $skills = [ordered]@{}
  foreach ($s in $v.skill) {
    $sid = [int](Get-Num $s.id)
    if ($sid -ge 0 -and $sid -lt $skillNames.Count) {
      $skills[$skillNames[$sid]] = (Get-Num $s.multiplier 1)
    }
  }

  $f = $v.formula
  $classes += [pscustomobject][ordered]@{
    id           = $id
    codename     = "class_$id"
    archetype    = $archetype
    gainPerLevel = [ordered]@{ hp = $gainHp; mana = $gainMp; capacity = $gainCap }
    regen        = [ordered]@{
      hp   = [ordered]@{ ticks = [int](Get-Num $v.gainhpticks);   amount = [int](Get-Num $v.gainhpamount) }
      mana = [ordered]@{ ticks = [int](Get-Num $v.gainmanaticks); amount = [int](Get-Num $v.gainmanaamount) }
    }
    manaMultiplier = (Get-Num $v.manamultiplier 1)
    magicShield    = $shield
    attackSpeedMs  = [int](Get-Num $v.attackspeed 2000)
    baseSpeed      = [int](Get-Num $v.basespeed 220)
    damage         = [ordered]@{
      melee    = (Get-Num $f.meleeDamage 1)
      distance = (Get-Num $f.distDamage 1)
      defense  = (Get-Num $f.defense 1)
      armor    = (Get-Num $f.armor 1)
    }
    skillMultipliers = $skills
  }
  $classNames["class_$id"] = [string]$v.name
}
Write-Json -Data ([ordered]@{ _meta = $provenance; classes = $classes }) -Path (Join-Path $OutDir 'classes.json')

# ---------------------------------------------------------------- 3. INIMIGOS
Write-Host "[3/5] inimigos (monstros)"

$monsterFiles = @(Get-ChildItem -Path (Join-Path $TfsPath 'data\monster') -Filter *.xml -Recurse -File |
                  Where-Object { $_.Name -ne 'monsters.xml' })

$enemies = @()
$enemyNames = @{}
$failed = 0
foreach ($file in $monsterFiles) {
  try {
    $m = ([xml](Get-Content -Raw -Encoding UTF8 $file.FullName)).monster
    if (-not $m) { continue }

    $hp  = [int](Get-Num $m.health.max)
    $exp = [int](Get-Num $m.experience)

    $attacks = @()
    $heal    = $null
    $dps     = 0.0
    foreach ($a in @($m.attacks.attack)) {
      if (-not $a) { continue }
      $interval = [int](Get-Num $a.interval 2000)
      $chance   = if ($a.chance) { [int](Get-Num $a.chance) } else { 100 }
      $maxAbs   = [math]::Abs((Get-Num $a.max))
      $minAbs   = [math]::Abs((Get-Num $a.min))
      $radius   = if ($a.radius) { [int](Get-Num $a.radius) } else { $null }
      $length   = if ($a.length) { [int](Get-Num $a.length) } else { $null }
      $attacks += [pscustomobject][ordered]@{
        type     = [string]$a.name
        interval = $interval
        chance   = $chance
        min      = [int]$minAbs
        max      = [int]$maxAbs
        range    = if ($a.range) { [int](Get-Num $a.range) } else { $null }
        radius   = $radius
        length   = $length
        aoe      = ($null -ne $radius -or $null -ne $length)
      }
      if ($interval -gt 0) {
        $dps += ((($minAbs + $maxAbs) / 2) * ($chance / 100.0)) / ($interval / 1000.0)
      }
    }
    foreach ($d in @($m.defenses.defense)) {
      if ($d -and [string]$d.name -eq 'healing') {
        $heal = [ordered]@{
          interval = [int](Get-Num $d.interval 2000)
          chance   = [int](Get-Num $d.chance 100)
          min      = [int][math]::Abs((Get-Num $d.min))
          max      = [int][math]::Abs((Get-Num $d.max))
        }
      }
    }

    $flags = [ordered]@{}
    foreach ($fl in @($m.flags.flag)) {
      if ($fl -and $fl.Attributes.Count -ge 1) {
        $flags[[string]$fl.Attributes[0].Name] = (Get-Num $fl.Attributes[0].Value)
      }
    }
    $elements = [ordered]@{}
    foreach ($el in @($m.elements.element)) {
      if ($el -and $el.Attributes.Count -ge 1) {
        $elements[([string]$el.Attributes[0].Name -replace 'Percent$', '')] = [int](Get-Num $el.Attributes[0].Value)
      }
    }
    $immunities = @(foreach ($im in @($m.immunities.immunity)) {
      if ($im -and $im.Attributes.Count -ge 1) { [string]$im.Attributes[0].Name }
    })
    $loot = @(foreach ($it in @($m.loot.item)) {
      if ($it -and $it.id) {
        [ordered]@{
          item = [int](Get-Num $it.id)
          p    = [math]::Round((Get-Num $it.chance) / 100000.0, 5)
          max  = if ($it.countmax) { [int](Get-Num $it.countmax) } else { 1 }
        }
      }
    })
    # cuidado: @($null).Count vale 1 em PowerShell, por isso o filtro explicito
    $summonCount = if ($m.summons) { @($m.summons.summon | Where-Object { $_ }).Count } else { 0 }

    # papel derivado do comportamento declarado
    $hasRanged = @($attacks | Where-Object { $_.type -ne 'melee' -and ($_.range -or $_.aoe) }).Count -gt 0
    $hasAoe    = @($attacks | Where-Object { $_.aoe }).Count -gt 0
    $role =
      if     ($summonCount -gt 0 -and $hasRanged) { 'summoner-caster' }
      elseif ($summonCount -gt 0)                 { 'summoner' }
      elseif ($hasAoe -and $heal)                 { 'caster-healer' }
      elseif ($hasAoe)                            { 'caster' }
      elseif ($hasRanged)                         { 'ranged' }
      elseif ($heal)                              { 'melee-healer' }
      else                                        { 'melee' }

    # exp 0 = entrada utilitaria (bicho de ambiente, boneco de treino, pet):
    # fica fora das bandas de balanceamento, tier 0
    $isCombat = ($exp -gt 0)
    $tier =
      if     (-not $isCombat) { 0 }
      elseif ($exp -lt 25)    { 1 }
      elseif ($exp -lt 150)   { 2 }
      elseif ($exp -lt 800)   { 3 }
      elseif ($exp -lt 4000)  { 4 }
      elseif ($exp -lt 20000) { 5 }
      else                    { 6 }

    $id = if ($m.raceId) { [int](Get-Num $m.raceId) } else { 0 }
    $codename = if ($id -gt 0) { "e{0:d5}" -f $id } else { "ex_" + ("{0:x8}" -f $file.BaseName.GetHashCode()) }

    $enemies += [pscustomobject][ordered]@{
      codename      = $codename
      id            = $id
      tier          = $tier
      combat        = $isCombat
      role          = $role
      race          = [string]$m.race
      family        = if ($m.bestiary) { ([string]$m.bestiary.class).ToLower() } else { $null }
      difficultyTag = if ($m.bestiary) { [string]$m.bestiary.difficulty } else { $null }
      occurrence    = if ($m.bestiary) { [string]$m.bestiary.occurrence } else { $null }
      hp            = $hp
      exp           = $exp
      speed         = [int](Get-Num $m.speed)
      armor         = [int](Get-Num $m.defenses.armor)
      defense       = [int](Get-Num $m.defenses.defense)
      dps           = [math]::Round($dps, 1)
      # razao resistencia/ameaca: HP por ponto de dano por segundo do proprio inimigo.
      # Alto = saco de pancada inofensivo; baixo = fragil e letal. NAO e tempo-para-matar,
      # que depende do dano do jogador.
      bulkToThreat  = if ($dps -gt 0) { [math]::Round($hp / $dps, 1) } else { $null }
      attacks       = $attacks
      heal          = $heal
      elements      = $elements
      immune        = $immunities
      summons       = $summonCount
      flags         = $flags
      loot          = $loot
    }
    $enemyNames[$codename] = [string]$m.name
  } catch {
    $failed++
  }
}

$enemies = @($enemies | Sort-Object tier, exp, codename)
Write-Host ("  {0} inimigos, {1} arquivos ilegiveis" -f $enemies.Count, $failed)
Write-Json -Data ([ordered]@{ _meta = $provenance; enemies = $enemies }) -Path (Join-Path $OutDir 'enemies.json') -Compress

# bandas de balanceamento por tier
$median = {
  param($arr)
  if ($arr.Count -eq 0) { return 0 }
  return $arr[[int][math]::Floor($arr.Count / 2)]
}
$combatEnemies = @($enemies | Where-Object { $_.combat })
$tiers = @(foreach ($g in ($combatEnemies | Group-Object tier | Sort-Object { [int]$_.Name })) {
  $hpv  = @($g.Group.hp  | Sort-Object)
  $dpsv = @($g.Group.dps | Sort-Object)
  $expv = @($g.Group.exp | Sort-Object)
  [ordered]@{
    tier     = [int]$g.Name
    count    = $g.Count
    hp       = [ordered]@{ min = $hpv[0];  median = (& $median $hpv);  max = $hpv[-1] }
    dps      = [ordered]@{ min = $dpsv[0]; median = (& $median $dpsv); max = $dpsv[-1] }
    exp      = [ordered]@{ min = $expv[0]; median = (& $median $expv); max = $expv[-1] }
    expPerHp = [math]::Round((& $median $expv) / [math]::Max(1, (& $median $hpv)), 3)
    roles    = [ordered]@{}
  }
})
foreach ($t in $tiers) {
  foreach ($r in ($combatEnemies | Where-Object { $_.tier -eq $t.tier } | Group-Object role | Sort-Object Count -Descending)) {
    $t.roles[$r.Name] = $r.Count
  }
}
Write-Json -Data ([ordered]@{
  _meta = $provenance
  _note = 'Bandas calculadas apenas sobre inimigos de combate (exp > 0). As ' +
          "$($enemies.Count - $combatEnemies.Count) entradas utilitarias (tier 0) ficam em enemies.json com combat=false."
  tiers = $tiers
}) -Path (Join-Path $OutDir 'tiers.json')

# ---------------------------------------------------------------- 4. ITENS
Write-Host "[4/5] itens"

$itemsPath = Join-Path $TfsPath 'data\items\items.xml'
$ix = [xml](Get-Content -Raw -Encoding UTF8 $itemsPath)
$keep = @('weight','attack','defense','extradef','armor','weaponType','slotType','ammoType','shootType',
          'range','maxHitChance','hitChance','elementFire','elementEarth','elementEnergy','elementIce',
          'elementDeath','elementHoly','elementPhysical','charges','duration','containerSize','skillSword',
          'skillAxe','skillClub','skillDist','skillShield','magiclevelpoints','healthGain','manaGain')

$items = @()
$itemNames = @{}
foreach ($it in $ix.items.item) {
  $attrs = [ordered]@{}
  foreach ($a in @($it.attribute)) {
    if (-not $a) { continue }
    $k = [string]$a.key
    if ($keep -contains $k) {
      $val = [string]$a.value
      $num = 0.0
      $attrs[$k] = if ([double]::TryParse($val, $script:NumStyle, $script:Inv, [ref]$num)) { $num } else { $val }
    }
  }
  if ($attrs.Count -eq 0) { continue }
  $isGear = $attrs.Contains('weaponType') -or $attrs.Contains('armor') -or $attrs.Contains('ammoType') -or
            ($attrs.Contains('attack') -and $attrs.Contains('defense'))
  if (-not $isGear) { continue }

  $id = if ($it.id) { [int](Get-Num $it.id) } elseif ($it.fromid) { [int](Get-Num $it.fromid) } else { continue }
  $kind =
    if     ($attrs.Contains('ammoType'))        { 'ammo' }
    elseif ($attrs['weaponType'] -eq 'shield')  { 'shield' }
    elseif ($attrs.Contains('weaponType'))      { 'weapon' }
    else                                        { 'armor' }

  $codename = "i{0:d5}" -f $id
  $items += [pscustomobject][ordered]@{
    codename   = $codename
    id         = $id
    kind       = $kind
    weaponType = if ($attrs.Contains('weaponType')) { $attrs['weaponType'] } else { $null }
    slot       = if ($attrs.Contains('slotType'))   { $attrs['slotType'] }   else { $null }
    attack     = [int](Get-Num $attrs['attack'])
    defense    = [int](Get-Num $attrs['defense'])
    extraDef   = [int](Get-Num $attrs['extradef'])
    armor      = [int](Get-Num $attrs['armor'])
    weight     = [int](Get-Num $attrs['weight'])
    range      = if ($attrs.Contains('range')) { [int](Get-Num $attrs['range']) } else { $null }
    attrs      = $attrs
  }
  $itemNames[$codename] = [string]$it.name
}
$items = @($items | Sort-Object kind, @{ Expression = { $_.attack + $_.armor + $_.defense }; Descending = $true })
Write-Host ("  {0} itens de combate" -f $items.Count)
Write-Json -Data ([ordered]@{ _meta = $provenance; items = $items }) -Path (Join-Path $OutDir 'items.json') -Compress

# ---------------------------------------------------------------- 5. SPELLS
Write-Host "[5/5] spells (coeficientes)"

$damageTypes = @{
  COMBAT_PHYSICALDAMAGE = 'physical'; COMBAT_ENERGYDAMAGE = 'energy'; COMBAT_EARTHDAMAGE = 'earth'
  COMBAT_FIREDAMAGE     = 'fire';     COMBAT_ICEDAMAGE    = 'ice';    COMBAT_HOLYDAMAGE  = 'holy'
  COMBAT_DEATHDAMAGE    = 'death';    COMBAT_LIFEDRAIN    = 'lifedrain'
  COMBAT_MANADRAIN      = 'manadrain'; COMBAT_HEALING     = 'healing'
}

$spells = @()
$spellNames = @{}
$spellIdx = 0
foreach ($f in Get-ChildItem (Join-Path $TfsPath 'data\scripts\spells\attack') -Filter *.lua -File) {
  $src = Get-Content -Raw -Encoding UTF8 $f.FullName
  $spellIdx++

  # corpo da callback, quando existir
  $body = if ($src -match '(?s)function\s+onGetFormulaValues\s*\([^)]*\)(.*?)\r?\nend') { $Matches[1] } else { $src }

  $lvl  = '(?:player:getLevel\(\)|level)'
  $mlvl = '(?:magicLevel|maglevel)'
  $coef = $null

  if ($body -match "local\s+min\s*=\s*\(?$lvl\s*/\s*(\d+)\)?\s*\+\s*\(?$mlvl\s*\*\s*([\d.]+)\)?\s*\+\s*([\d.]+)") {
    $coef = [ordered]@{
      family = 'levelMagic'; levelDivisor = [int]$Matches[1]
      aMin = [double]$Matches[2]; bMin = [double]$Matches[3]
      aMax = [double]$Matches[2]; bMax = [double]$Matches[3]
    }
    if ($body -match "local\s+max\s*=\s*\(?$lvl\s*/\s*\d+\)?\s*\+\s*\(?$mlvl\s*\*\s*([\d.]+)\)?\s*\+\s*([\d.]+)") {
      $coef.aMax = [double]$Matches[1]; $coef.bMax = [double]$Matches[2]
    }
  }
  elseif ($body -match "local\s+min\s*=\s*\(?$lvl\s*/\s*(\d+)\)?\s*\+\s*\(skill\s*\*\s*attack\s*\*\s*([\d.]+)\)\s*\+\s*([\d.]+)") {
    $coef = [ordered]@{
      family = 'skillAttack'; levelDivisor = [int]$Matches[1]
      aMin = [double]$Matches[2]; bMin = [double]$Matches[3]
      aMax = [double]$Matches[2]; bMax = [double]$Matches[3]
    }
    if ($body -match "local\s+max\s*=\s*\(?$lvl\s*/\s*\d+\)?\s*\+\s*\(skill\s*\*\s*attack\s*\*\s*([\d.]+)\)\s*\+\s*([\d.]+)") {
      $coef.aMax = [double]$Matches[1]; $coef.bMax = [double]$Matches[2]
    }
  }
  elseif ($body -match 'return\s*-\s*([\d.]+)\s*,\s*-\s*([\d.]+)') {
    $coef = [ordered]@{
      family = 'flat'; levelDivisor = $null
      aMin = 0; bMin = [double]$Matches[1]
      aMax = 0; bMax = [double]$Matches[2]
    }
  }
  elseif ($src -match 'setFormula\(COMBAT_FORMULA_LEVELMAGIC,\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)') {
    $coef = [ordered]@{
      family = 'levelMagic'; levelDivisor = 5
      aMin = [math]::Abs([double]$Matches[1]); bMin = [math]::Abs([double]$Matches[2])
      aMax = [math]::Abs([double]$Matches[3]); bMax = [math]::Abs([double]$Matches[4])
      note = 'declarada via COMBAT_FORMULA_LEVELMAGIC'
    }
  }
  elseif ($body -match 'local\s+min\s*=\s*(.+)') {
    # escala por outra fonte (ex. skill de distancia): preserva a expressao
    $minExpr = $Matches[1].Trim()
    $maxExpr = if ($body -match 'local\s+max\s*=\s*(.+)') { $Matches[1].Trim() } else { $null }
    $coef = [ordered]@{ family = 'custom'; minExpr = $minExpr; maxExpr = $maxExpr }
  }
  if (-not $coef) { continue }

  $dmgType = 'physical'
  if ($src -match 'COMBAT_PARAM_TYPE,\s*(COMBAT_\w+)') {
    if ($damageTypes.ContainsKey($Matches[1])) { $dmgType = $damageTypes[$Matches[1]] }
  }
  $reqLevel   = if ($src -match 'spell:level\((\d+)\)')    { [int]$Matches[1] } else { $null }
  $mana       = if ($src -match 'spell:mana\((\d+)\)')     { [int]$Matches[1] } else { $null }
  $cooldown   = if ($src -match 'spell:cooldown\((\d+)\)') { [int]$Matches[1] } else { $null }
  $area       = $src -match 'createCombatArea|AREA_'
  $needTarget = $src -match 'spell:needTarget\(true\)|COMBAT_PARAM_DISTANCEEFFECT'

  $codename = "s{0:d3}" -f $spellIdx
  $spells += [pscustomobject][ordered]@{
    codename             = $codename
    damageType           = $dmgType
    requiresLevel        = $reqLevel
    manaCost             = $mana
    cooldownMs           = $cooldown
    aoe                  = [bool]$area
    needsTarget          = [bool]$needTarget
    formula              = $coef
    # dano medio por mana com magic level 50 - so compara dentro da familia levelMagic
    manaEfficiencyAtMl50 = if ($coef.family -eq 'levelMagic' -and $mana -gt 0) {
        [math]::Round((((($coef.aMin + $coef.aMax) / 2) * 50) + (($coef.bMin + $coef.bMax) / 2)) / $mana, 2)
      } else { $null }
  }
  if ($src -match 'spell:name\("([^"]+)"\)') { $spellNames[$codename] = $Matches[1] }
}
$spells = @($spells | Sort-Object { $_.requiresLevel })
Write-Host ("  {0} spells de ataque com formula" -f $spells.Count)
Write-Json -Data ([ordered]@{ _meta = $provenance; spells = $spells }) -Path (Join-Path $OutDir 'spells.json')

# ---------------------------------------------------- mapa local (nao versionado)
if ($WithNames) {
  Write-Host "`n[extra] mapa de nomes -> .local/ (nao versionado)"
  Write-Json -Data ([ordered]@{
    _warning = 'Referencia de projeto apenas. Nomes de origem (CipSoft/TFS). Nao versionar, nao publicar.'
    classes  = $classNames
    enemies  = $enemyNames
    items    = $itemNames
    spells   = $spellNames
  }) -Path (Join-Path $LocalDir 'names.json') -Compress
}

Write-Host "`nPronto: $OutDir"
