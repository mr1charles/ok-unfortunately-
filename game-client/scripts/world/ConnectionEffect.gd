extends RefCounted
## The "these pixels are connected" energy effect: a brief expanding,
## fading emissive ring plus a short burst of particles at the connection
## point. Deliberately subtle and short-lived (spec: "do not make the
## effect overwhelming"), and easy to strip out entirely if a player
## disables effects - see Main.gd `effects_enabled`.

const DURATION := 0.7


static func spawn(parent: Node3D, world_pos: Vector3, color: Color) -> void:
	var effect := Node3D.new()
	parent.add_child(effect)
	effect.global_position = world_pos + Vector3(0, 0.4, 0)

	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.05
	torus.outer_radius = 0.6
	ring.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color.a = 0.85
	ring.material_override = mat
	ring.rotation_degrees.x = 90
	effect.add_child(ring)

	var particles := GPUParticles3D.new()
	particles.amount = 24
	particles.lifetime = DURATION
	particles.one_shot = true
	particles.explosiveness = 0.9
	particles.emitting = true
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 180.0
	pm.initial_velocity_min = 1.0
	pm.initial_velocity_max = 2.5
	pm.gravity = Vector3(0, -2.0, 0)
	pm.scale_min = 0.05
	pm.scale_max = 0.12
	pm.color = color
	particles.process_material = pm
	particles.draw_pass_1 = BoxMesh.new()
	effect.add_child(particles)

	var tween := effect.create_tween()
	tween.tween_property(ring, "scale", Vector3.ONE * 2.2, DURATION).set_trans(Tween.TRANS_CUBIC)
	tween.parallel().tween_property(mat, "albedo_color:a", 0.0, DURATION)
	tween.tween_callback(effect.queue_free)
