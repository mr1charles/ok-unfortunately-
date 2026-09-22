extends Node3D
## Crosshair-driven pixel selection: since the mouse is captured for
## third-person camera look (there's no free 2D cursor to drag in a real 3D
## game), "click and drag" becomes "hold left mouse and look around" - the
## selection rectangle follows whatever pixel is under the crosshair while
## the button is held, exactly like painting a build-selection in a
## Minecraft-style game. Releasing finalizes the rectangle.

signal selection_finalized(x1: int, y1: int, x2: int, y2: int)
signal selection_changed(count: int)

var player: Node3D
var highlight: MeshInstance3D
var is_selecting: bool = false
var anchor: Vector2i = Vector2i.ZERO
var current: Vector2i = Vector2i.ZERO


func _ready() -> void:
	highlight = MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(1, 0.06, 1)
	highlight.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.85, 0.2, 0.55)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.85, 0.2)
	mat.emission_energy_multiplier = 0.6
	highlight.material_override = mat
	highlight.visible = false
	add_child(highlight)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			if player and player.target_pixel != null:
				is_selecting = true
				anchor = player.target_pixel
				current = player.target_pixel
		elif is_selecting:
			is_selecting = false
			var x1: int = min(anchor.x, current.x)
			var y1: int = min(anchor.y, current.y)
			var x2: int = max(anchor.x, current.x)
			var y2: int = max(anchor.y, current.y)
			selection_finalized.emit(x1, y1, x2, y2)


func _process(_delta: float) -> void:
	if player == null:
		return
	var target = player.target_pixel
	if target == null:
		highlight.visible = false
		return

	if is_selecting:
		current = target

	var x1: int
	var y1: int
	var x2: int
	var y2: int
	if is_selecting:
		x1 = min(anchor.x, current.x)
		y1 = min(anchor.y, current.y)
		x2 = max(anchor.x, current.x)
		y2 = max(anchor.y, current.y)
	else:
		x1 = target.x
		y1 = target.y
		x2 = target.x
		y2 = target.y

	var w := float(x2 - x1 + 1)
	var h := float(y2 - y1 + 1)
	highlight.visible = true
	highlight.scale = Vector3(w, 1.0, h)
	highlight.position = Vector3(x1 + w / 2.0, 0.05, y1 + h / 2.0)

	if is_selecting:
		selection_changed.emit(int(w * h))


func clear() -> void:
	is_selecting = false
	highlight.visible = false
