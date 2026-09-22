extends RefCounted
## Visible defense dome: a translucent blue hemisphere placed over a
## property's footprint whenever it has an active Defense on the server.
## Purely cosmetic feedback - the server is what actually blocks attacks.

static func spawn(parent: Node3D, center: Vector3, radius: float) -> MeshInstance3D:
	var dome := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = radius
	sphere.height = radius * 1.15
	sphere.is_hemisphere = true
	dome.mesh = sphere
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.35, 0.75, 1.0, 0.16)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.emission_enabled = true
	mat.emission = Color(0.35, 0.75, 1.0)
	mat.emission_energy_multiplier = 0.35
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dome.material_override = mat
	dome.position = center
	parent.add_child(dome)
	return dome
