extends CharacterBody3D
## Third-person player character: builds its own visual/camera rig in code
## (no hand-authored .tscn node tree) so the whole hierarchy is easy to
## review and change in one place. WASD to move, mouse to look, Space to
## jump, Shift to sprint, matches the InputMap set up by InputSetup.gd.

const WALK_SPEED := 5.0
const SPRINT_SPEED := 9.0
const JUMP_VELOCITY := 7.0
const GRAVITY := 18.0
const MOUSE_SENSITIVITY := 0.0035
const MAX_PITCH := deg_to_rad(80.0)
const INTERACT_DISTANCE := 18.0

var camera_pivot: Node3D
var spring_arm: SpringArm3D
var camera: Camera3D
var mesh_root: Node3D
var body_mesh: MeshInstance3D
var head_mesh: MeshInstance3D

var mouse_captured: bool = true
var yaw: float = 0.0
var pitch: float = -0.35

## World-pixel coordinate (Vector2i) the camera is currently looking at on
## the ground plane, or null if nothing valid is in range. Read by
## PixelSelector/HUD every frame - see Main.gd.
var target_pixel: Variant = null
var target_world_point: Vector3 = Vector3.ZERO


func _ready() -> void:
	_build_visuals()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_apply_appearance(GameState.character_appearance)


func _build_visuals() -> void:
	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.4
	shape.height = 1.8
	collision.shape = shape
	collision.position = Vector3(0, 0.9, 0)
	add_child(collision)

	mesh_root = Node3D.new()
	add_child(mesh_root)

	body_mesh = MeshInstance3D.new()
	var capsule := CapsuleMesh.new()
	capsule.radius = 0.35
	capsule.height = 1.3
	body_mesh.mesh = capsule
	body_mesh.position = Vector3(0, 0.75, 0)
	var body_mat := StandardMaterial3D.new()
	body_mat.albedo_color = Color(0.31, 0.49, 1.0)
	body_mesh.material_override = body_mat
	mesh_root.add_child(body_mesh)

	head_mesh = MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.26
	sphere.height = 0.52
	head_mesh.mesh = sphere
	head_mesh.position = Vector3(0, 1.62, 0)
	var head_mat := StandardMaterial3D.new()
	head_mat.albedo_color = Color(0.91, 0.72, 0.58)
	head_mesh.material_override = head_mat
	mesh_root.add_child(head_mesh)

	camera_pivot = Node3D.new()
	camera_pivot.position = Vector3(0, 1.5, 0)
	add_child(camera_pivot)

	spring_arm = SpringArm3D.new()
	spring_arm.spring_length = 6.0
	spring_arm.rotation.x = pitch
	camera_pivot.add_child(spring_arm)

	camera = Camera3D.new()
	camera.current = true
	spring_arm.add_child(camera)


func _apply_appearance(appearance: Dictionary) -> void:
	if appearance.is_empty():
		return
	var body_mat := body_mesh.material_override as StandardMaterial3D
	if body_mat and appearance.has("outfitColor"):
		body_mat.albedo_color = Color(String(appearance["outfitColor"]))
	var head_mat := head_mesh.material_override as StandardMaterial3D
	if head_mat and appearance.has("skinColor"):
		head_mat.albedo_color = Color(String(appearance["skinColor"]))


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and mouse_captured:
		yaw -= event.relative.x * MOUSE_SENSITIVITY
		pitch = clamp(pitch - event.relative.y * MOUSE_SENSITIVITY, -MAX_PITCH, MAX_PITCH)
		camera_pivot.rotation.y = yaw
		spring_arm.rotation.x = pitch

	if event.is_action_pressed("toggle_mouse_capture"):
		mouse_captured = not mouse_captured
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if mouse_captured else Input.MOUSE_MODE_VISIBLE
	elif event is InputEventMouseButton and event.pressed and not mouse_captured:
		mouse_captured = true
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _physics_process(delta: float) -> void:
	_handle_movement(delta)
	_update_target_pixel()


func _handle_movement(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	elif Input.is_action_just_pressed("jump"):
		velocity.y = JUMP_VELOCITY

	var input_dir := Vector2(
		Input.get_action_strength("move_right") - Input.get_action_strength("move_left"),
		Input.get_action_strength("move_back") - Input.get_action_strength("move_forward")
	)
	var basis_yaw := Basis(Vector3.UP, yaw)
	var direction := (basis_yaw * Vector3(input_dir.x, 0, input_dir.y))
	if direction.length() > 0.001:
		direction = direction.normalized()

	var speed := SPRINT_SPEED if Input.is_action_pressed("sprint") else WALK_SPEED
	velocity.x = direction.x * speed
	velocity.z = direction.z * speed

	if direction.length() > 0.001:
		var target_angle := atan2(direction.x, direction.z)
		mesh_root.rotation.y = lerp_angle(mesh_root.rotation.y, target_angle, delta * 10.0)

	move_and_slide()


## Casts the camera's forward ray against the y=0 ground plane (the pixel
## grid always sits at world y=0) and converts the intersection to an
## integer pixel coordinate. No physics colliders are used for this - with
## up to 100,000,000 pixels, per-pixel collision shapes would be
## catastrophic for performance, so this is pure ray/plane math instead.
func _update_target_pixel() -> void:
	if camera == null:
		return
	var from := camera.global_transform.origin
	var dir := -camera.global_transform.basis.z
	if abs(dir.y) < 0.0001:
		target_pixel = null
		return
	var t := -from.y / dir.y
	if t <= 0.0 or t > INTERACT_DISTANCE:
		target_pixel = null
		return
	var point := from + dir * t
	target_world_point = point
	target_pixel = Vector2i(int(floor(point.x)), int(floor(point.z)))
