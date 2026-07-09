const FIRE_PARTICLES = Array.from({ length: 12 }, (_, index) => index);

// Short-lived CSS fire overlay shown when a province is broken.
function FireEffect() {
    return (
        <div className="fire-effect">
            <div className="fire-effect__glow" />
            { FIRE_PARTICLES.map(index => (
                <span
                    key={ index }
                    className="fire-effect__particle"
                    style={ {
                        left: `${5 + (index * 37) % 90}%`,
                        animationDelay: `${(index * 0.13) % 0.8}s`,
                        animationDuration: `${0.7 + (index % 4) * 0.18}s`
                    } }
                />
            )) }
        </div>
    );
}

FireEffect.displayName = "FireEffect";

export default FireEffect;
