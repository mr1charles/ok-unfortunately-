extends Node3D
## One streamed chunk of the pixel world: a single flat gray ground quad
## (representing every still-unowned pixel in the chunk at zero extra cost)
## plus one GPU-instanced MultiMesh covering every OWNED pixel in the chunk.
## This is the perf-critical piece that makes a 100,000,000-pixel world
## practical to render: a chunk with zero owned pixels costs exactly one
## quad, and even a fully-owned 64x64 chunk costs one draw call via
## instancing rather than 4,096 separate nodes.

const PIXEL_HEIGHT := 0.12

var chunk_x: int
var chunk_y: int
var chunk_size: int
var ground: MeshInstance3D
var pixels_multimesh: MultiMeshInstance3D


func setup(p_chunk_x: int, p_chunk_y: int, p_chunk_size: int) -> void:
	chunk_x = p_chunk_x
	chunk_y = p_chunk_y
	chunk_size = p_chunk_size

	var origin_x := chunk_x * chunk_size
	var origin_y := chunk_y * chunk_size

	ground = MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(chunk_size, chunk_size)
	ground.mesh = plane
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.62, 0.62, 0.62)
	mat.roughness = 0.9
	ground.material_override = mat
	ground.position = Vector3(origin_x + chunk_size / 2.0, 0.0, origin_y + chunk_size / 2.0)

	add_child(ground)

	# Physics body is a SIBLING of the ground mesh (not a child of it) -
	# nesting a CollisionShape3D under a MeshInstance3D triggers a harmless
	# but noisy debug-mesh warning under the headless/dummy renderer.
	var body := StaticBody3D.new()
	var collision := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(chunk_size, 0.2, chunk_size)
	collision.shape = box
	body.add_child(collision)
	body.position = ground.position + Vector3(0, -0.1, 0)
	add_child(body)

	pixels_multimesh = MultiMeshInstance3D.new()
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(0.92, PIXEL_HEIGHT, 0.92)
	mm.mesh = box_mesh
	mm.instance_count = 0
	pixels_multimesh.multimesh = mm
	var pixel_mat := StandardMaterial3D.new()
	pixel_mat.vertex_color_use_as_albedo = true
	pixels_multimesh.material_override = pixel_mat
	add_child(pixels_multimesh)


## Rebuilds the owned-pixel instances from a `pixels` array as returned by
## GET /worlds/:id/chunks (each entry: {x, y, colorHex, ownerId, ...}).
func set_pixels(pixels: Array) -> void:
	var mm := pixels_multimesh.multimesh
	mm.instance_count = pixels.size()
	for i in range(pixels.size()):
		var p: Dictionary = pixels[i]
		var px := int(p.get("x", 0))
		var py := int(p.get("y", 0))
		var xf := Transform3D(Basis(), Vector3(px + 0.5, PIXEL_HEIGHT / 2.0, py + 0.5))
		mm.set_instance_transform(i, xf)
		mm.set_instance_color(i, Color(String(p.get("colorHex", "#4f7cff"))))
